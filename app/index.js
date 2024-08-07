"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readLine = __importStar(require("readline"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = require("crypto");
const childProcess = __importStar(require("child_process"));
const LOG_FILE_PATH = `${__dirname}\\Logs\\`;
class WrittenLogs {
    constructor(Name) {
        this.Ready = false;
        let DateObject = new Date();
        this.Name = Name || `${DateObject.getFullYear()}_${DateObject.getDate()}_${DateObject.getMonth()}-${DateObject.getTime()}`;
        this.Path = `${LOG_FILE_PATH}\\${this.Name}.txt`;
        // Check if the folder exists
        if (!fs_1.default.existsSync(LOG_FILE_PATH)) {
            fs_1.default.mkdirSync(LOG_FILE_PATH);
        }
        let exists = fs_1.default.existsSync(this.Path);
        if (!exists) {
            fs_1.default.writeFile(this.Path, "LOGS START", (err) => {
                if (err) {
                    console.log(err);
                }
                this.Ready = true;
            });
        }
        else {
            this.Ready = true;
        }
    }
    WaitForReady() {
        return __awaiter(this, void 0, void 0, function* () {
            while (!this.Ready) {
                yield Wait(0.2);
            }
        });
    }
    Append(Content) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.WaitForReady();
            // Clean up strings that have been modified by me
            Content
                .replace("???!", "")
                .replace("??!", "")
                .replace("?!", "")
                .replace("!?", "");
            fs_1.default.appendFileSync(this.Path, `\n${Content}`);
        });
    }
}
let exitPlease = false;
let hashMap = new Map();
let hashMapQueue = [];
let controller = null;
const rlInterface = readLine.createInterface({
    input: process.stdin,
    output: process.stdout
});
const clear = console.clear;
const logs = new WrittenLogs();
function QueueAction(callback) {
    hashMapQueue.push(callback);
}
function RequestUser(request) {
    return new Promise((res) => {
        rlInterface.question(`${request}${!request.endsWith("\n") && ": " || " "}`, res);
    });
}
function Wait(seconds) {
    return new Promise((res) => {
        setTimeout(() => {
            res(true);
        }, seconds * 1000);
    });
}
/**
 * Put ?! WORDS !? around the words that needs to be blue
 * @param output Unformatted string
 */
function Print(output) {
    let formatted = output
        .replace("???!", "\x1b[31m")
        .replace("??!", "\x1b[33m")
        .replace("?!", "\x1b[34m")
        .replace("!?", "\x1b[0m");
    console.log(formatted);
}
function FindDublicates(path, logs, gatherFiles) {
    return __awaiter(this, void 0, void 0, function* () {
        let controllerConnections = {
            gather: [],
            dublicate: [],
            error: [],
            check: [],
            recurse: []
        };
        controller = {
            on: (event, callback) => {
                controllerConnections[event].push(callback);
            },
            emit: (event, ...args) => {
                let pathSplit = args[0].split("\\");
                let name = pathSplit[pathSplit.length - 1];
                let eventArray = controllerConnections[event];
                for (const index in eventArray) {
                    eventArray[index](name, ...args);
                }
            }
        };
        let started = 0;
        let finished = 0;
        // Actual deletion loop
        function RecurseRun(path) {
            return __awaiter(this, void 0, void 0, function* () {
                let files = fs_1.default.readdirSync(path);
                for (const index in files) {
                    new Promise((res, rej) => {
                        started++;
                        let filePath = `${path}\\${files[index]}`;
                        fs_1.default.stat(filePath, (err, stat) => __awaiter(this, void 0, void 0, function* () {
                            if (err) {
                                rej(err);
                                return;
                            }
                            if (stat.isDirectory()) {
                                // Recurse into folder
                                RecurseRun(filePath);
                                res({ status: "recurse", path: filePath });
                                return;
                            }
                            // It's a file, test it
                            let content = fs_1.default.readFileSync(filePath);
                            if (content) {
                                QueueAction(() => {
                                    let hash = (0, crypto_1.createHash)("sha256");
                                    hash.update(content);
                                    let hashedData = hash.digest("hex");
                                    let dublicateExists = hashMap.has(hashedData);
                                    let hashArray = dublicateExists && hashMap.get(hashedData) || [];
                                    if (dublicateExists) {
                                        hashArray.push(filePath);
                                        hashMap.set(hashedData, hashArray);
                                        res({ status: "dublicate", path: filePath });
                                        return;
                                    }
                                    hashArray.push(filePath);
                                    hashMap.set(hashedData, hashArray);
                                    res({ status: "file", path: filePath });
                                });
                            }
                            else {
                                res({ status: "none", path: filePath });
                            }
                        }));
                    })
                        .then((result) => {
                        if (!controller) {
                            return;
                        }
                        if (result.status == "file") {
                            controller.emit("check", result.path);
                        }
                        else if (result.status == "recurse") {
                            controller.emit("recurse", result.path);
                        }
                        else if (result.status == "dublicate") {
                            controller.emit("dublicate", result.path);
                        }
                    })
                        .catch((err) => {
                        if (!controller) {
                            return;
                        }
                        controller.emit("error", err);
                    })
                        .finally(() => {
                        finished++;
                    });
                }
            });
        }
        clear();
        RecurseRun(path);
        controller.on("dublicate", (fileName) => {
            let logString = `Found dublicate ??!${fileName}!?`;
            Print(logString);
            logs.Append(logString);
        });
        controller.on("gather", (fileName) => {
            let logString = `Gathered dublicate ??!${fileName}!?`;
            Print(logString);
            logs.Append(logString);
        });
        controller.on("error", (fileName, err) => {
            let logString = `ERROR on dublicate ???!${fileName}!?: ${err}`;
            Print(logString);
            logs.Append(logString);
        });
        controller.on("check", (fileName) => {
            let logString = `Checked object ?!${fileName}!?`;
            Print(logString);
            logs.Append(logString);
        });
        controller.on("recurse", (fileName) => {
            let logString = `Found directory ?!${fileName}!?, recursing...`;
            Print(logString);
            logs.Append(logString);
        });
        while (finished < started) {
            yield Wait(0.1);
        }
        if (gatherFiles) { // Gather files
            console.log("Sorry, the feature to gather all clones hasn't been implemented yet ;(");
        }
        else { // Display files
            clear();
            Print(`Do you want to deal with the ?!${hashMap.size}!? dublicates found? [Y/N]`);
            let answer = (yield RequestUser("")).toString().toLowerCase();
            let handleFilesNow = answer == "y" || answer == "ye" || answer == "yes";
            if (!handleFilesNow) {
                return;
            }
            let hashArray = Array.from(hashMap);
            for (const index in hashArray) {
                function recurse() {
                    return __awaiter(this, void 0, void 0, function* () {
                        clear();
                        Print(`Handling file #${Number.parseInt(index) + 1}/${hashArray.length}`);
                        let object = hashArray[index];
                        let key = object[0];
                        let files = object[1];
                        Print(`Dublicates for ?!${key}!?`);
                        for (const index in files) {
                            Print(` ${index} - ${files[index]}`);
                        }
                        let answer = (yield RequestUser(`\nSelect the files to be spared (Seperate with a comma ",")`)).toString().split(",");
                        let hasOnlyNumber = true;
                        for (const index in answer) {
                            if (Number.isNaN(Number.parseInt(answer[index]))) {
                                hasOnlyNumber = false;
                                break;
                            }
                        }
                        if (answer[0] == "" || !hasOnlyNumber) {
                            clear();
                            Print("An error was noticed with one of your IDs, please try again!");
                            yield Wait(1.5);
                            return yield recurse();
                        }
                    });
                }
                yield recurse();
            }
            yield Wait(20);
        }
        return;
    });
}
function ShowMenu() {
    return __awaiter(this, void 0, void 0, function* () {
        console.clear();
        let answer = yield RequestUser(`Please press [1] to deal with dublicates, press [2] to see the log files, and press [3] to exit the program!`);
        if (answer == 1) { // Find dublicates
            logs.Append("Opened menu [1]");
            clear();
            let clearPath = yield RequestUser("Please provide the path that includes all or a large part of the dublicates");
            if (typeof (clearPath) != "string" || !fs_1.default.existsSync(clearPath)) {
                Print("Invalid path!");
                yield Wait(2);
                return;
            }
            clear();
            let gatherFilesResponse = (yield RequestUser("Should the dublicates be gathered after they're found? [Y/N]")).toString().toLowerCase();
            let gatherFiles = gatherFilesResponse == "y" || gatherFilesResponse == "ye" || gatherFilesResponse == "yes";
            clear();
            Print("Searching...");
            yield FindDublicates(clearPath, logs, gatherFiles);
        }
        else if (answer == 2) { // View logfiles
            logs.Append("Opened log folder");
            childProcess.exec(`start "" "${LOG_FILE_PATH}"`);
        }
        else if (answer == 3) {
            logs.Append("Interface shutdown requested");
            exitPlease = true;
        }
        else {
            Print("Invalid input, try again...");
            logs.Append(`Invalid input on menu selection: "${answer}"`);
        }
        yield Wait(1);
    });
}
function QueueHandlerLoop() {
    return __awaiter(this, void 0, void 0, function* () {
        while (!exitPlease) {
            if (hashMapQueue.length == 0) {
                yield Wait(0.3);
                continue;
            }
            // Treat requests
            let exitTreatmentLoop = false;
            while (!exitTreatmentLoop) {
                yield new Promise((res) => __awaiter(this, void 0, void 0, function* () {
                    let callback = hashMapQueue.shift();
                    if (!callback) {
                        exitTreatmentLoop = true;
                        res(true);
                        return;
                    }
                    yield callback();
                    res(true);
                }))
                    .catch((err) => {
                    if (!err) {
                        return;
                    }
                    if (controller) {
                        controller.emit("error", err);
                    }
                    else {
                        console.log(err);
                    }
                });
            }
        }
    });
}
QueueHandlerLoop();
function RunLoop() {
    return __awaiter(this, void 0, void 0, function* () {
        while (!exitPlease) {
            yield ShowMenu();
        }
        logs.Append("Closing interface!");
        rlInterface.close();
    });
}
RunLoop();
