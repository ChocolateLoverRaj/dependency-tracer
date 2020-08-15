import DependencyTracer from "../index.js"

(async () => {
    var nodeModuleReader = new DependencyTracer()

    await nodeModuleReader.ready

    return await nodeModuleReader.getDependents("leadingzero")
})()
    .then(list => {
        console.log(list)
    })
    .catch(err => {
        console.log(err)
    })