import DependencyTracer from "../index.js"

(async () => {
    var dependencyTracer = new DependencyTracer()

    await dependencyTracer.ready

    return await dependencyTracer.trace("gulp-util")
})()
    .then(list => {
        console.log(list)
    })
    .catch(err => {
        console.log(err)
    })