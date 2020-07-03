"use strict";

/**
 * Main script of the 'host preparation' stage.
 *
 */

const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const log = require("npmlog");

const utils = require("../utils/utils");
const model = require("../utils/model");
const cst = require("../const");
const config = require(cst.CONFIGPATH);
const db = require(cst.DBPATH);

const scripts = require("./scripts");
const currentStage = config.getHostPrepareStatusCode();

// Fetch secrets:
// const secrets = config.getSecrets();

//
//  Fetching the instance definition based on the provided UUID
//
var instanceDef = db.getInstanceDefinition(
  process.env[config.varInstanceUuid()]
);
if (_.isEmpty(instanceDef)) {
  throw new Error("Illegal argument: empty or unexisting instance definition.");
}

//
//  Host metadata
//
var ssh = instanceDef.deployment.host.value; // TODO this should be extracted based on the host type
var hostDir = hostDir = path.resolve(
    instanceDef.deployment.hostDir,
    instanceDef.name
);

//
//  Building the script
//
var script = new model.Script();
script.type = "#!/bin/bash";
script.headComment = "# Autogenerated script for the CD host preparation...";
script.body = [];
script.body.push("set -xe\n");

script.body.push(
  scripts.remote(ssh, scripts.initFolder(hostDir, ssh.user, ssh.group, false))
);

// 'artifacts'

if (process.env[config.varArtifactsChanges()] === "true") {
  var hostArtifactsDir = hostDir + "/artifacts";
  script.body.push(
    scripts.remote(
      ssh,
      scripts.initFolder(hostArtifactsDir, ssh.user, ssh.group, false),
      true
    )
  );
  Object.assign(ssh, { remoteDst: true });
  script.body.push(
    scripts.rsync(
      ssh,
      config.getCDArtifactsDirPath(instanceDef.uuid),
      hostArtifactsDir,
      true
    )
  );
}

// 'deployment'

if (process.env[config.varDeploymentChanges()] === "true") {
  const deploymentScripts = require("./impl/" + instanceDef.deployment.type);
  // TODO: most likely a `docker login` here
  script.body.push(
    deploymentScripts.hostPreparation.getDeploymentScript(instanceDef)
  );
  // Configure proxy servers
  var proxies = instanceDef.deployment.proxies;
  if (!_.isEmpty(proxies)) {
    proxies.forEach(function(proxy) {
      script.body.push(
        scripts.remote(
          ssh,
          scripts[proxy.type].createProxy(
            proxy.value,
            instanceDef.deployment.maintenanceUrl,
            instanceDef.deployment.selinux
          )
        )
      );
    });
  }
}

// 'data'

if (process.env[config.varDataChanges()] === "true") {
  // shouldn't this be managed by docker/docker-compose?
  instanceDef.data.forEach(function(data) {
    var instanceDataDir = hostDir + "/data";
    var sourceDataDir;
    if (data.type === "instance") {
      if (!_.isEmpty(data.value.uuid)) {
        // Retrieve the source instance
        var sourceInstance = db.getInstanceDefinition(data.value.uuid);
        if (_.isEmpty(sourceInstance)) {
          log.error(
            "",
            "Source instance definition could not be found. Instance can not use data of non-existing instance."
          );
          throw new Error(
            "Illegal argument: empty or unexisting instance definition."
          );
        }
        sourceDataDir = sourceInstance.deployment.hostDir + "/data/";
      }
      if (!_.isEmpty(data.value.dataDir)) {
        sourceDataDir = data.value.dataDir;
      }
      script.body.push(
        scripts.remote(
          ssh,
          scripts.rsync(
            "",
            sourceDataDir,
            instanceDataDir,
            true,
            null,
            null,
            true
          )
        )
      );
    }
  });
}

script.body = scripts.computeAdditionalScripts(
  script.body,
  instanceDef,
  currentStage,
  config,
  process.env
).script;

script.body = script.body.join(cst.SCRIPT_SEPARATOR);

//
//  Saving the script in the current build dir.
//
fs.writeFileSync(
  path.resolve(config.getBuildDirPath(), config.getHostPrepareScriptName()),
  utils.getScriptAsString(script)
);
fs.chmodSync(
  path.resolve(config.getBuildDirPath(), config.getHostPrepareScriptName()),
  "0755"
);

// Saving the status
fs.writeFileSync(
  path.resolve(config.getBuildDirPath(), config.getStatusFileName()),
  JSON.stringify({ status: currentStage })
);
