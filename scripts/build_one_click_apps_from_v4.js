/**
 * /*jshint esversion: 6
 *
 * @format
 */

const path = require("path")
const yaml = require("yaml")
const _ = require('lodash')
const fs = require("fs-extra")

const pathOfPublic = path.join(__dirname, "..", `public`)

const pathOfDist = path.join(__dirname, "..", `dist`)

const pathOfDistV2 = path.join(pathOfDist, "v2")
const pathOfDistV3 = path.join(pathOfDist, "v3")
const pathOfDistV4 = path.join(pathOfDist, "v4")

const pathOfSourceDirectory = path.join(pathOfPublic, "v4")
const pathOfSourceDirectoryApps = path.join(pathOfSourceDirectory, "apps")
const pathOfSourceDirectoryLogos = path.join(pathOfSourceDirectory, "logos")


fs.mkdirpSync(pathOfDistV2)
fs.mkdirpSync(pathOfDistV3)
fs.mkdirpSync(pathOfDistV4)
fs.mkdirpSync(pathOfSourceDirectory)
fs.mkdirpSync(pathOfSourceDirectoryApps)
fs.mkdirpSync(pathOfSourceDirectoryLogos)

/**
 * Creates a listing of apps for GET http://oneclickapps.caprover.com/v4
 * {
    "oneClickApps": [
     {
      "name": "adminer",
      "displayName": "Adminer",
      "description": "Adminer (formerly phpMinAdmin) is a full-featured database management tool written in PHP",
      "isOfficial": true,
      "logoUrl": "adminer.png"
     },.....]}
 */
/**
 *
 * @param {string[]} appsFileNames
 * @param {string} pathOfApps
 * @returns {Promise<{apps: string[], appDetails: Array<{name: string, displayName: string, description: string, isOfficial: boolean, logoUrl: string}[], appsFileNames: string[]}>>}
 */
async function createAppList(appsFileNames, pathOfApps) {
    /**
     * @type {string[]}
     */
    const apps = appsFileNames.filter((v) => `${v}`.endsWith(".yml"))

    if (apps.length !== appsFileNames.length) {
        throw new Error("All files in v4 must end with .yml extension!")
    }
    /**
     * @type {Array<{name: string, displayName: string, description: string, isOfficial: boolean, logoUrl: string}>}
     */
    const appDetails = []

    for (var i = 0; i < apps.length; i++) {
        const contentString = await fs.readFile(
            path.join(pathOfApps, apps[i]),
            "utf-8"
        )
        const content = yaml.parse(contentString)
        const captainVersion = `${content.captainVersion}`

        apps[i] = apps[i].replace(".yml", "")
        const caproverOneClickApp = content.caproverOneClickApp

        if (captainVersion === "4") {
            if (!caproverOneClickApp.displayName) {
                caproverOneClickApp.displayName = apps[i]
                caproverOneClickApp.displayName =
                    caproverOneClickApp.displayName.substr(0, 1).toUpperCase() +
                    caproverOneClickApp.displayName.substring(
                        1,
                        caproverOneClickApp.displayName.length
                    )
            }
            if (!caproverOneClickApp.description)
                caproverOneClickApp.description = ""

            appDetails[i] = {
                name: apps[i],
                displayName: caproverOneClickApp.displayName,
                description: caproverOneClickApp.description,
                isOfficial:
                    `${caproverOneClickApp.isOfficial}`.toLowerCase().trim() ===
                    "true",
                logoUrl: apps[i] + ".png"
            }
        } else {
            throw new Error("Unknown captain-version: " + captainVersion)
        }
    }

    return {
        appList: apps,
        appDetails: appDetails
    }
}
/**
 *
 * @param {string} v4String
 * @returns {object}
 */
function convertV4toV2(v4String) {
    const parsed = JSON.parse(v4String)
    if (`${parsed.captainVersion}` !== "4") {
        throw new Error("CaptainVersion must be 4 for this conversion")
    }

    function moveProperty(propertyName) {
        parsed[propertyName] = parsed.caproverOneClickApp[propertyName]
    }

    parsed.dockerCompose = {
        services: parsed.services
    }
    parsed.services = undefined

    parsed.captainVersion = 2

    moveProperty("variables")
    moveProperty("instructions")
    moveProperty("displayName")
    moveProperty("isOfficial")
    moveProperty("description")
    moveProperty("documentation")

    Object.keys(parsed.dockerCompose.services).forEach((serviceName) => {
        const service = parsed.dockerCompose.services[serviceName]

        if (!service.caproverExtra) {
            return
        }

        if (service.caproverExtra.containerHttpPort) {
            service.containerHttpPort = service.caproverExtra.containerHttpPort
        }
        if (service.caproverExtra.dockerfileLines) {
            service.dockerfileLines = service.caproverExtra.dockerfileLines
        }
        if (service.caproverExtra.notExposeAsWebApp) {
            service.notExposeAsWebApp = service.caproverExtra.notExposeAsWebApp
        }

        service.caproverExtra = undefined
    })

    parsed.caproverOneClickApp = undefined
    return parsed
}

/**
 *
 * @returns {Promise<true>}
 * @throws {Error}
 */
async function buildDist() {
    const appsFileNames = await fs.readdir(pathOfSourceDirectoryApps)
    try {
        appsFileNames.forEach((appFileName) => {
            console.log("Building dist for " + appFileName)

            const pathOfAppFileInSource = path.join(
                pathOfSourceDirectoryApps,
                appFileName
            )
            const contentParsed = yaml.parse(
                fs.readFileSync(pathOfAppFileInSource, "utf-8")
            )

            //v4
            fs.outputJsonSync(
                path.join(pathOfDistV4, `apps`, appFileName.split(".")[0]),
                contentParsed
            )

            //v3
            _.attempt(fs.outputJsonSync, path.join(pathOfDistV3, `apps`, appFileName.split(".")[0]), convertV4toV2(JSON.stringify(contentParsed)))
/**
                fs.outputJsonSync(
                    path.join(pathOfDistV3, `apps`, appFileName.split(".")[0]),
                    convertV4toV2(JSON.stringify(contentParsed))
                )
*/

            //v2
            fs.outputJsonSync(
                path.join(
                    pathOfDistV2,
                    `apps`,
                    appFileName.split(".")[0] + ".json"
                ),
                convertV4toV2(JSON.stringify(contentParsed))
            )
        })
    } catch (err) {
        console.error("Could not build dist")
        console.error(err)
        throw err
    }
    try {
        await fs.copy(
            pathOfSourceDirectoryLogos,
            path.join(pathOfDistV2, `logos`)
        )
        await fs.copy(
            pathOfSourceDirectoryLogos,
            path.join(pathOfDistV3, `logos`)
        )
        await fs.copy(
            pathOfSourceDirectoryLogos,
            path.join(pathOfDistV4, `logos`)
        )
    } catch (err) {
        console.error("Could not copy logos")
        console.error(err)
        throw err
    }
    const allAppsList = createAppList(appsFileNames, pathOfSourceDirectoryApps)
    const v3List = {
        oneClickApps: allAppsList.appDetails
    }
    // Remove once we are fully on V4
    if (await fs.stat(path.join(pathOfDistV3, "list"))) {
        const v3ListExisting = await fs.readFile(
            path.join(pathOfDistV3, "list"),
            "utf-8"
        )
        if (v3ListExisting && JSON.parse(v3ListExisting).oneClickApps) {
            v3List.oneClickApps = [
                ...v3List.oneClickApps,
                ...JSON.parse(v3ListExisting).oneClickApps
            ]
            const names = {}
            const list = []
            v3List.oneClickApps.forEach((a) => {
                if (!names[a.name]) {
                    list.push(a)
                    names[a.name] = true
                }
            })
            v3List.oneClickApps = list.sort(function (a_1, b) {
                return `${a_1.name}`.localeCompare(b.name)
            })

            allAppsList.appList = list.map((l) => l.name)
            allAppsList.appDetails = v3List.oneClickApps
        }
    }
    try {
        await fs.outputJson(
            path.join(pathOfDistV2, "autoGeneratedList.json"),
            allAppsList
        )
        await fs.outputJson(path.join(pathOfDistV2, "list"), v3List)
        //await fs.outputJson(path.join(pathOfDistV3, "list"), v3List)
        await fs.outputJson(path.join(pathOfDistV4, "list"), v3List)
        await fs.copy(
            path.join(pathOfPublic, "CNAME"),
            path.join(pathOfDist, "CNAME")
        )
    } catch (err) {
        console.error("Could not copy lists")
        console.error(err)
        throw err
    }
    return true
}

const start = function () {
    return Promise.resolve()
        .then(function () {
            return buildDist()
        })
        .catch(function (err) {
            console.error(err)
            process.exit(127)
        })
}

start().then(console.log).catch(console.error)