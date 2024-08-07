import * as readLine from "readline"
import fs from "fs"
import { createHash } from "crypto"
import * as childProcess from "child_process"

type ControllerType = {
    on: (event: FindDublicatesEventNames, callback: FindDublicatesCallback) => void;
    emit: (event: FindDublicatesEventNames, ...args: any) => void;
}

const LOG_FILE_PATH = `${__dirname}\\Logs\\`

class WrittenLogs {
    Name : string
    Path : string
    Ready : boolean = false
    constructor(Name? : string) {
        let DateObject = new Date()
        this.Name = Name || `${DateObject.getFullYear()}_${DateObject.getDate()}_${DateObject.getMonth()}-${DateObject.getTime()}`
        this.Path = `${LOG_FILE_PATH}\\${this.Name}.txt`

        // Check if the folder exists
        if (!fs.existsSync(LOG_FILE_PATH)) {
            fs.mkdirSync(LOG_FILE_PATH)
        }

        let exists = fs.existsSync(this.Path)
        if (!exists) {
            fs.writeFile(this.Path,"LOGS START",(err) => {
                if (err) {
                    console.log(err)
                }

                this.Ready = true
            })
        } else {
            this.Ready = true
        }
    }

    async WaitForReady() {
        while (!this.Ready) {
            await Wait(0.2)
        }
    }

    async Append(Content : string) {
        await this.WaitForReady()
        // Clean up strings that have been modified by me

        Content
            .replace("???!","")
            .replace("??!","")
            .replace("?!","")
            .replace("!?","")
        fs.appendFileSync(this.Path,`\n${Content}`)
    }
}


let exitPlease = false
let hashMap : Map<string,string[]> = new Map()
let hashMapQueue : ((...args : any) => any)[] = []
let controller : ControllerType | null = null

const rlInterface = readLine.createInterface({
    input : process.stdin,
    output : process.stdout
})

const clear = console.clear
const logs = new WrittenLogs()

function QueueAction(callback : (...args : any) => any) {
    hashMapQueue.push(callback)
}

function RequestUser(request : string) : Promise<string | number> {
    return new Promise((res) => {
        rlInterface.question(`${request}${!request.endsWith("\n") && ": " || " "}`,res)
    })
}

function Wait(seconds : number) : Promise<true> {
    return new Promise((res) => {
        setTimeout(() => {
            res(true)
        },seconds * 1000)
    })
}

/**
 * Put ?! WORDS !? around the words that needs to be blue
 * @param output Unformatted string
 */
function Print(output : string) {
    let formatted = output
        .replace("???!","\x1b[31m")
        .replace("??!","\x1b[33m")
        .replace("?!","\x1b[34m")
        .replace("!?","\x1b[0m")

    console.log(formatted)
}

type FindDublicatesCallback = ((fileName : string, ...args:any) => any)
type FindDublicatesEventNames = "gather" | "dublicate" | "error" | "check" | "recurse"
async function FindDublicates(path : string, logs : WrittenLogs, gatherFiles? : boolean) {
    let controllerConnections : {[k in FindDublicatesEventNames] : FindDublicatesCallback[]} & {error : ((error : Error) => any)[]} = {
        gather : [],
        dublicate : [],
        error : [],
        check : [],
        recurse : []
    }
    
    controller = {
        on : (event : FindDublicatesEventNames,callback : FindDublicatesCallback) => {
            controllerConnections[event].push(callback)
        },

        emit : (event : FindDublicatesEventNames,...args:any) => {
            let pathSplit = args[0].split("\\")
            let name = pathSplit[pathSplit.length - 1]
            let eventArray = controllerConnections[event]
            for (const index in eventArray) {
                eventArray[index](name,...args)
            }
        }
    }

    let started = 0
    let finished = 0

    // Actual deletion loop
    async function RecurseRun(path : string) {
        let files = fs.readdirSync(path)
        for (const index in files) {
            new Promise((res : (value : {status : "recurse" | "file" | "dublicate" | "none", path : string}) => void,rej) => {
                started++
                let filePath = `${path}\\${files[index]}`
                fs.stat(filePath,async (err,stat) => {
                    if (err) {
                        rej(err)
                        return
                    }
    
                    if (stat.isDirectory()) {
                        // Recurse into folder
                        RecurseRun(filePath)
                        res({status : "recurse",path : filePath})
                        return
                    }
    
                    // It's a file, test it
                    let content = fs.readFileSync(filePath)
                    if (content) {
                        QueueAction(() => {
                            let hash = createHash("sha256")
                            hash.update(content)
                            let hashedData = hash.digest("hex")
                            let dublicateExists = hashMap.has(hashedData)
                            let hashArray = dublicateExists && hashMap.get(hashedData) || []
                            if (dublicateExists) {
                                hashArray.push(filePath)
                                hashMap.set(hashedData,hashArray)
                                res({status : "dublicate",path : filePath})
                                return
                            }

                            hashArray.push(filePath)
                            hashMap.set(hashedData,hashArray)
                            res({status : "file",path : filePath})
                        })
                    } else {
                        res({status : "none",path : filePath})
                    }
                })
            })
            .then((result) => {
                if (!controller) {
                    return
                }

                if (result.status == "file") {
                    controller.emit("check",result.path)
                } else if (result.status == "recurse") {
                    controller.emit("recurse",result.path)
                } else if (result.status == "dublicate") {
                    controller.emit("dublicate",result.path)
                }
            })
            .catch((err) => {
                if (!controller) {
                    return
                }

                controller.emit("error",err)
            })
            .finally(() => {
                finished++
            })
        }
    }
    clear()
    RecurseRun(path)

    controller.on("dublicate",(fileName) => {
        let logString = `Found dublicate ??!${fileName}!?`
        Print(logString)
        logs.Append(logString)
    })

    controller.on("gather",(fileName) => {
        let logString = `Gathered dublicate ??!${fileName}!?`
        Print(logString)
        logs.Append(logString)
    })

    controller.on("error",(fileName,err : Error) => {
        let logString = `ERROR on dublicate ???!${fileName}!?: ${err}`
        Print(logString)
        logs.Append(logString)
    })

    controller.on("check",(fileName) => {
        let logString = `Checked object ?!${fileName}!?`
        Print(logString)
        logs.Append(logString)
    })

    controller.on("recurse",(fileName) => {
        let logString = `Found directory ?!${fileName}!?, recursing...`
        Print(logString)
        logs.Append(logString)
    })

    while (finished < started) {
        await Wait(0.1)
    }

    if (gatherFiles) { // Gather files
        console.log("Sorry, the feature to gather all clones hasn't been implemented yet ;(")
    } else { // Display files
        clear()

        Print(`Do you want to deal with the ?!${hashMap.size}!? dublicates found? [Y/N]`)
        let answer = (await RequestUser("")).toString().toLowerCase()
        let handleFilesNow = answer == "y" || answer == "ye" || answer == "yes"

        if (!handleFilesNow) {
            return
        }

        let hashArray = Array.from(hashMap)
        for (const index in hashArray) {
            async function recurse() : Promise<void> {
                clear()
                Print(`Handling file #${Number.parseInt(index) + 1}/${hashArray.length}`)
                let object = hashArray[index]
                let key = object[0]
                let files = object[1]

                Print(`Dublicates for ?!${key}!?`)

                for (const index in files) {
                    Print(` ${index} - ${files[index]}`)
                }

                let answer = (await RequestUser(`\nSelect the files to be spared (Seperate with a comma ",")`)).toString().split(",")
                let hasOnlyNumber = true
                for (const index in answer) {
                    if (Number.isNaN(Number.parseInt(answer[index]))) {
                        hasOnlyNumber = false
                        break
                    }
                }

                if (answer[0] == "" || !hasOnlyNumber) {
                    clear()
                    Print("An error was noticed with one of your IDs, please try again!")
                    await Wait(1.5)
                    return await recurse()
                }


            }
            await recurse()
        }
        await Wait(20)
    }

    return
}

async function ShowMenu() {
    console.clear()
    let answer = await RequestUser(`Please press [1] to deal with dublicates, press [2] to see the log files, and press [3] to exit the program!`)

    if (answer == 1) { // Find dublicates
        logs.Append("Opened menu [1]")

        clear()
        let clearPath = await RequestUser("Please provide the path that includes all or a large part of the dublicates")
        if (typeof(clearPath) != "string" || !fs.existsSync(clearPath)) {
            Print("Invalid path!")
            await Wait(2)
            return
        }

        clear()
        let gatherFilesResponse = (await RequestUser("Should the dublicates be gathered after they're found? [Y/N]")).toString().toLowerCase()
        let gatherFiles = gatherFilesResponse == "y" || gatherFilesResponse == "ye" || gatherFilesResponse == "yes"

        clear()
        Print("Searching...")
        await FindDublicates(clearPath,logs,gatherFiles)
    } else if (answer == 2) { // View logfiles
        logs.Append("Opened log folder")
        childProcess.exec(`start "" "${LOG_FILE_PATH}"`)
    } else if (answer == 3) {
        logs.Append("Interface shutdown requested")
        exitPlease = true
    } else {
        Print("Invalid input, try again...")
        logs.Append(`Invalid input on menu selection: "${answer}"`)
    }

    await Wait(1)
}

async function QueueHandlerLoop() {
    while (!exitPlease) {
        if (hashMapQueue.length == 0) {
            await Wait(0.3)
            continue
        }

        // Treat requests
        let exitTreatmentLoop = false
        while (!exitTreatmentLoop) {
            await new Promise(async (res) => {
                let callback = hashMapQueue.shift()
                if (!callback) {
                    exitTreatmentLoop = true
                    res(true)
                    return
                }

                await callback()
                res(true)
            })
            .catch((err) => {
                if (!err) {
                    return
                }

                if (controller) {
                    controller.emit("error",err)
                } else {
                    console.log(err)
                }
            })
        }
    }
}
QueueHandlerLoop()

async function RunLoop() {
    while (!exitPlease) {
        await ShowMenu()
    }

    logs.Append("Closing interface!")
    rlInterface.close()
}
RunLoop()