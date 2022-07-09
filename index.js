let fs = window.require('fs')
let spawn = window.require('child_process').spawn
let execPath = window.require('process').execPath
let pathJoin = window.require('path').join;

let axios = require('axios')

let platform = window.require('os').platform()

let appPath = window.require('electron').remote.app.getAppPath()
let appPathFolder = appPath.slice(0, appPath.indexOf('app.asar'))
let asarTmpPath = pathJoin(appPathFolder, "update_asar");

class AsarUpdater {

    constructor(checkVersionUrl) {

      this.checkVersionUrl = ''
  
      this.isUpdateAvailable = false
      this.updateVersion = ''
      this.updateDescription = ''
      this.downloadUrl = 'http://'
      
      this.downloadProgress = 0

      this.checkVersionUrl = checkVersionUrl
    }

    async checkUpdates(curentVersion) {
  
      let r = await axios.get(this.checkVersionUrl, { responseType: 'json' });
      if (this.compareVersions(r.data.version, curentVersion)) {
        this.updateVersion = r.data.version
        this.updateDescription = r.data.updateDescription
        this.downloadUrl = r.data.downloadUrl
        
        console.log("checkUpdates");
        console.log(this)
        console.log("r.data.downloadUrl", r.data.downloadUrl)
        console.log("this.downloadUrl", this.downloadUrl)

        this.isUpdateAvailable = true
      }
      
      return this.isUpdateAvailable
    }

    compareVersions(updateVersion, currentVersion) {
      let appVersionSplitted = currentVersion.split('.')
      let updateVersionSplitted = updateVersion.split('.')
alert(currentVersion)
alert(updateVersion)
      let ma = parseInt(appVersionSplitted[0])
      let mb = parseInt(appVersionSplitted[1]) 
      let mc = parseInt(appVersionSplitted[2])
      
      let ua = parseInt(updateVersionSplitted[0])
      let ub = parseInt(updateVersionSplitted[1])
      let uc = parseInt(updateVersionSplitted[2])

      if (ua > ma)
          return true
      if (ua === ma && ub > mb)
          return true
      if (ua === ma && ub === mb && uc > mc)
          return true

      return false
    }

    generateWinScript(scriptPath) {

      var stream = fs.createWriteStream(scriptPath)

      stream.write("On Error Resume Next\n")
      stream.write("Set wshShell = WScript.CreateObject(\"WScript.Shell\")\n")
      stream.write("Set fsObject = WScript.CreateObject(\"Scripting.FileSystemObject\")\n")
      stream.write("updaterPath=\""+asarTmpPath+"\"\n")
      stream.write("destPath=\"resources\\app.asar\"\n")

      stream.write("Do While fsObject.FileExists(destPath)\n")
      stream.write("fsObject.DeleteFile destPath\n")
      stream.write("WScript.Sleep 250\n")
      stream.write("Loop\n")

      stream.write("WScript.Sleep 250\n")
      stream.write("fsObject.MoveFile updaterPath,destPath\n")
      stream.write("WScript.Sleep 250\n")

      let execPath = window.require('electron').remote.process.execPath;

      stream.write("wshShell.Run \".\\"+ execPath.substr(execPath.lastIndexOf("\\") + 1) +"\"\n")

      stream.end()
    } 

    async update() {
      let appPath = window.require('electron').remote.app.getAppPath()
      let appPathFolder = appPath.slice(0, appPath.indexOf('app.asar'))
  
      console.log("update():")
      console.log(this)
      console.log(this.checkVersionUrl)
      console.log(this.downloadUrl)

      let r = await axios({
          method: "get",
          responseType: 'arraybuffer',
          baseURL: this.downloadUrl + "?ts=" + new Date().getTime(),
          onDownloadProgress: (progressEvent) => {
            var percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            this.downloadProgress = percentCompleted
          }
      })

      let asarData = r.data
      fs.writeFileSync(asarTmpPath, new Buffer(asarData))

      try {
        switch (platform) 
        {
          case "win32":
          {
            this.generateWinScript("resources/updater.vbs")
            let winArgs = "\"wscript.exe\" \"resources\\updater.vbs\""
            spawn('cmd', ['/s', '/c', '"' + winArgs + '"'], {
                detached: true,
                windowsVerbatimArguments: true,
                stdio: 'ignore',
                windowsHide: true
            }) 
          }
          break;
          case "linux":
          {
            let params = ["-c", [ "cd " + JSON.stringify(appPathFolder), 'mv -f ' + JSON.stringify(asarTmpPath) + ' app.asar', "sleep 5", execPath].join(" && ")]
            spawn("bash", params, { detached: true })
          }
          break;
          case "darwin":
          {
            let params = ["-c", [ "mv -f " + JSON.stringify(asarTmpPath) + ' ' + JSON.stringify(appPathFolder + 'app.asar'), "sleep 5", "open " + JSON.stringify(pathJoin(appPathFolder, '../../'))].join(" && ")]
            spawn("bash", params, { detached: true })
          }
          break;
          default:
            alert("Unsupported platform")
        }
      } catch (e) {
          alert("Update error!\n" + e.toString())
      }

      window.setTimeout(() => {
        window.close()
      }, 1000);
      
    }
}


module.exports = {
  AsarUpdater
}