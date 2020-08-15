import { promises as fsPromises } from 'fs'
import { join } from 'path'

//TODO read devDependencies too.
//TODO put in github

//Reads the current environments, 
class NodeModuleReader {
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
                //The text in the package.json of this module
                var packageJsonText
                try {
                    packageJsonText = await fsPromises.readFile("./package.json", 'utf8')
                }
                catch (e) {
                    if (e.code = 'ENOENT') {
                        throw new ReferenceError("Couldn't find main package.json")
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

                //Save to this
                this.packageJson = {
                    name: packageName,
                    dependencies: dependencies
                }

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
    async getDependencies(packageName) {
        //Make sure this is ready
        this.checkReady()

        //Make sure the package is in node modules
        if (!this.dirs.includes(packageName)) {
            throw new ReferenceError("There is no folder with given name in node modules.")
        }

        //The utf8 text of package.json
        var packageJsonText
        try {
            packageJsonText = await fsPromises.readFile(join(this.modulesPath, packageName, "package.json"), 'utf8')
        }
        catch (e) {
            if (e.code === 'ENOENT') {
                throw new ReferenceError("package.json doesn't exist.")
            }
        }

        //The parsed object of package.json
        var packageJson
        try {
            packageJson = JSON.parse(packageJsonText)
        }
        catch (e) {
            throw new SyntaxError("Error parsing package.json")
        }

        //Make sure package.json is an object
        if (typeof packageJson !== 'object') {
            throw new TypeError("(package.json) is not an object.")
        }

        //The dependencies in package.json
        var dependencies = {}
        //If package.json explicitly has dependencies, add them
        if (packageJson.hasOwnProperty('dependencies')) {
            dependencies = packageJson.dependencies
        }
        //Make sure that the dependencies are an object
        if (typeof dependencies !== 'object') {
            throw new TypeError("(package.json).dependencies is not an object")
        }

        //Return the names of the dependencies
        return Object.keys(dependencies)
    }

    async getDependents(packageName) {
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
        const checkDependencies = (name, dependencies) => {
            //Check if it has the specified package
            if (dependencies.hasOwnProperty(packageName)) {
                //Add the name to dependents
                dependents.push(name)
            }
        }

        //Go through the dependencies in this module
        checkDependencies(this.packageJson.name, this.packageJson.dependencies)

        //Go through all the packages in node modules
        for (let usedPackage of this.dirs) {
            if (usedPackage.startsWith("@")) {
                console.log(usedPackage)
            }
            //Add a promise to readPromises
            readPromises.push((async () => {
                //The contents of package.json
                var packageJsonText
                try {
                    packageJsonText = await fsPromises.readFile(join(this.modulesPath, usedPackage, "package.json"))
                }
                catch (e) {
                    if (e.code === 'ENOENT') {
                        throw new ReferenceError(join(this.modulesPath, usedPackage, "package.json"))
                    }
                }

                //The parsed json
                var packageJson
                try {
                    packageJson = JSON.parse(packageJsonText)
                }
                catch (e) {
                    throw new SyntaxError("Couldn't parse package.json.")
                }

                //Make sure package.json is an object
                if (typeof packageJson !== 'object') {
                    throw new TypeError("(package.json) is not an object.")
                }

                //The package's dependencies
                var dependencies = {}
                //Check if the package explicitly has dependencies
                if (packageJson.hasOwnProperty('dependencies')) {
                    dependencies = packageJson.dependencies
                }
                //Make sure dependencies is an object
                if (typeof dependencies !== 'object') {
                    throw new TypeError("(package.json).dependencies is not an object.")
                }

                //Check the dependencies
                checkDependencies(usedPackage, dependencies)
            })())
        }

        //Wait for all the readPromises
        await Promise.all(readPromises)

        //Return the dependents
        return dependents
    }
}

(async () => {
    var nodeModuleReader = new NodeModuleReader()

    await nodeModuleReader.ready

    return await nodeModuleReader.getDependents("leadingzero")
})()
    .then(list => {
        console.log(list)
    })
    .catch(err => {
        console.log(err)
    })

export default NodeModuleReader