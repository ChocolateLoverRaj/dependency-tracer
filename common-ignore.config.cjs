module.exports = {
    inputDir: "./common-ignore",
    outputDir: "./",
    files: {
        "git.gitignore": {
            extends: ["common.gitignore"],
            output: ".gitignore"
        },
        "npm.npmignore": {
            extends: ["common.gitignore"],
            output: ".npmignore"
        }
    }
}