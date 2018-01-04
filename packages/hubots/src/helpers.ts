import * as path from 'path'
import * as fs from 'fs-extra'

export async function loadOtherScripts(fileName: string, loader: (scripts: string[]) => Promise<void>): Promise<void> {
  let scriptsFile = path.resolve('.', fileName)
  if (await fs.pathExists(scriptsFile)) {
    let data = await fs.readFile(scriptsFile)
    if (data.length > 0) {
      try {
        await loader(JSON.parse(data.toString()))
      } catch (e) {
        console.error(`Error parsing JSON data from ${fileName}: ${e}`)
        process.exit(1)
      }
    }
  }
}

export async function loadScripts(options, robot): Promise<void> {

  await loadOtherScripts('external-scripts.json', robot.loadExternalScripts.bind(robot))

  let scripts = options.require.concat([path.resolve('.', 'scripts'), path.resolve('.', 'src', 'scripts')])
  for (let scriptPath of scripts) {
    let scriptsPath = scriptPath[0] === '/' ? scriptPath : path.resolve('.', scriptPath)
    await robot.load(scriptsPath)
  }
}
