import { promises as fsPromises } from 'fs'
import { join } from 'path'

//TODO read devDependencies too.

//Read a package.json
const getDependencies = async packageJsonFile => {
    //The text in the package.json
    var packageJsonText
    try {
        packageJsonText = await fsPromises.readFile(packageJsonFile, 'utf8')
    }
    catch (e) {
        if (e.code = 'ENOENT') {
            throw new ReferenceError("Couldn't find package.json")
        }
    }

    //The json in package.json
    var packageJson
    try {
        packageJson = JSON.parse(packageJsonText)
    }
    catch (e) {
        throw new SyntaxError("Invalid package.json")
    }

    //Make sure packageJson is an object
    if (typeof packageJson !== 'object') {
        throw new TypeError("(package.json) is not an object.")
    }

    //Make sure package.json has a string name
    var packageName = packageJson.name
    if (typeof packageName !== 'string') {
        throw new TypeError("(package.json).name must be a string.")
    }

    //The dependencies in package.json
    var dependencies = {}
    //If package.json explicitly has dependencies, use those
    if (packageJson.hasOwnProperty('dependencies')) {
        dependencies = packageJson.dependencies
    }
    //Check that dependencies is an object
    if (typeof dependencies !== 'object') {
        throw new TypeError("(package.json).dependencies is not an object.")
    }

    //The devDependencies in package.json
    var devDependencies = {}
    //If the package.json explicitly has devDependencies, use those
    if (packageJson.hasOwnProperty('devDependencies')) {
        devDependencies = packageJson.devDependencies
    }
    //Check that devDependencies is an object
    if (typeof devDependencies !== 'object') {
        throw new TypeError("(package.json).devDependencies is not an object.")
    }

    //Return the info
    return {
        name: packageName,
        dependencies: dependencies,
        devDependencies: devDependencies
    }
}

//Reads the current environments
class DependencyTracer {
    //The modulesPath argument is if for some reason your modules aren't in "./node_modules"
    constructor(modulesPath = "./node_modules") {
        //Save the modulesPath in the object
        this.modulesPath = modulesPath

        //Whether or not the ready Promise was successful.
        //Undefined means it is still running
        this.success = undefined

        //The Promise that is resolved once the class is initialized
        this.ready = (async () => {
            //Promise that reads the folders
            var readDirPromise = (async () => {
                //Read the folders in node modules
                try {
                    this.dirs = await fsPromises.readdir(modulesPath)
                }
                catch (e) {
                    //If the error is 'ENOENT', it means it doesn't exist.
                    if (e.code === 'ENOENT') {
                        throw new ReferenceError("Modules folder doesn't exist.")
                    }
                }
                //Remove .bin folder if it exists
                var binIndex = this.dirs.indexOf('.bin')
                if (binIndex > -1) {
                    this.dirs.splice(binIndex, 1)
                }
                //Handle folders with @something
                //The array of promises of atDirs
                var atDirPromises = []
                //Get the dirs that start with @
                var atDirs = this.dirs.filter(value => value.startsWith('@'))
                //Go through all those folders
                for (let atDir of atDirs) {
                    //Add a promise to atDirPromises
                    atDirPromises.push((async () => {
                        //The subPackages in the scoped package
                        var subDirs
                        try {
                            subDirs = await fsPromises.readdir(join(this.modulesPath, atDir))
                        }
                        catch (e) {
                            if (e.code === 'ENOENT') {
                                throw new ReferenceError("Scoped package doesn't exist.")
                            }
                        }

                        //Remove the atDir from the dirs
                        this.dirs.splice(this.dirs.indexOf(atDir), 1)

                        //Add the scoped packages
                        for (let subDir of subDirs) {
                            this.dirs.push(`${atDir}/${subDir}`)
                        }

                        //Resolve the promise
                        return
                    })())
                }
                //Wait for the atDirPromises
                await Promise.all(atDirPromises)

                //Resolve this promise
                return
            })()

            //Promise that reads package.json
            var packageJsonPromise = (async () => {
                //Read the package.json
                this.packageJson = await getDependencies("./package.json")

                //Resolve the promise
                return
            })()

            //Wait for both promises
            await Promise.all([readDirPromise, packageJsonPromise])

            //Resolve the promise
            return
        })()
            .then(() => {
                //Ready is success
                this.success = true
            })
            .catch(() => {
                //Ready is not successful
                this.success = false
            })
    }

    //Checks if the class is ready
    checkReady() {
        switch (this.success) {
            //If it is undefined, it means the class isn't ready yet.
            case undefined:
                throw new Error("Not ready yet.")
                break
            //If it is false, then it means it failed
            case false:
                throw new Error("Failed to get ready.")
                break
        }
    }

    //Read a package.json and get its dependencies
    async getDependencies(packageName, dev = false) {
        //Make sure this is ready
        this.checkReady()

        //Make sure the package is in node modules
        if (!this.dirs.includes(packageName)) {
            throw new ReferenceError("There is no folder with given name in node modules.")
        }

        //Read the package.json file
        var {
            dependencies,
            devDependencies
        } = await getDependencies(join(this.modulesPath, packageName, "package.json"))

        //Check if we should also include devDependencies
        if (dev) {
            //Return the names of both dependencies and devDependencies
            return [...new Set([...Object.keys(dependencies), ...Object.keys(devDependencies)])]
        }
        else {
            //Return the names of the dependencies
            return Object.keys(dependencies)
        }
    }

    //Get all packages that depend on a package
    async getDependents(packageName, dev = false) {
        //Make sure this is ready
        this.checkReady()

        //Make sure the package exists in node modules
        if (!this.dirs.includes(packageName)) {
            throw new ReferenceError("There is no folder with given name in node modules.")
        }

        //The array of dependents found
        var dependents = []

        //The array of promises of packages being read
        var readPromises = []

        //Check dependencies of a package
        const checkDependencies = packageJson => {
            //The dependencies to use
            var dependencies = packageJson.dependencies
            //If devDependencies too, add those.
            if (dev) {
                dependencies = {
                    ...packageJson.dependencies,
                    ...packageJson.devDependencies
                }
            }

            //Check if it has the specified package
            if (dependencies.hasOwnProperty(packageName)) {
                //Add the name to dependents
                dependents.push(packageJson.name)
            }
        }

        //Go through the dependencies in this module
        checkDependencies(this.packageJson)

        //Go through all the packages in node modules
        for (let usedPackage of this.dirs) {
            //Add a promise to readPromises
            readPromises.push((async () => {
                //Read the package.json
                var packageJson = await getDependencies(join(this.modulesPath, usedPackage, "package.json"))

                //Check the dependencies
                checkDependencies(packageJson)
            })())
        }

        //Wait for all the readPromises
        await Promise.all(readPromises)

        //Return the dependents
        return dependents
    }

    //Trace a package back to the main package
    async trace(packageName, dev = false) {
        //Make sure this is ready
        this.checkReady()

        //List the dependents
        const listDependents = async (list) => {
            //The list of list promises
            var listPromises = []

            //Check if it is the main package
            if (list[0] === this.packageJson.name) {
                //Just wrap the list in an array
                listPromises.push(Promise.resolve([list]))
            }
            else {
                //Get the dependents
                var dependents = await this.getDependents(list[0], dev)

                //Loop through the dependents
                for (let dependent of dependents) {
                    listPromises.push(listDependents([dependent, ...list]))
                }
            }

            //Wait for all the list promises
            var lists = await Promise.all(listPromises)

            //Collapsed lists
            var allLists = []

            //Loop through the lists
            for (let list of lists) {
                allLists = allLists.concat(list)
            }

            //Return the organized lists
            return allLists
        }

        //List the dependents of the package
        return await listDependents([packageName])
    }
}

export default DependencyTracer