"use strict";

describe("Scripts", function() {
  // deps
  const path = require("path");
  const config = require(path.resolve("src/utils/config"));
  const cst = require(path.resolve("src/const"));
  const dockerCompose = require(path.resolve(
    "src/pipeline3/impl/dockerCompose"
  ));

  const scripts = require(path.resolve(
    "src/" + config.getJobNameForPipeline3() + "/scripts"
  ));

  describe("Pipeline steps", function() {
    var instanceDef = {
      uuid: "cacb5448-46b0-4808-980d-5521775671c0",
      name: "cambodia1",
      type: "dev",
      group: "tlc",
      deployment: {
        hostDir: "/var/docker-volumes/",
        type: "dockerCompose",
        value: {
          image: "mekomsolutions/bahmni",
          tag: "cambodia-release-0.90",
          ports: {
            "443": "8733",
            "80": "8180"
          },
          networks: ["network1", "network2"],
          services: ["proxy", "openmrs", "mysql"]
        },
        host: {
          type: "ssh",
          value: {
            ip: "hsc-dev.mekomsolutions.net",
            user: "mekom",
            port: "22"
          }
        }
      }
    };

    it("should generate docker compose Pre-Host Preparation deployment script", () => {
      expect(
        dockerCompose.preHostPreparation.getDeploymentScript(instanceDef)
      ).toEqual("");
    });

    it("should generate docker compose Pre-Host Preparation data script", () => {
      expect(
        dockerCompose.preHostPreparation.getDataScript(instanceDef)
      ).toEqual("");
    });

    it("should generate docker compose Pre-Host Preparation artifacts script", () => {
      expect(
        dockerCompose.preHostPreparation.getArtifactsScript(instanceDef)
      ).toEqual("");
    });

    it("should generate docker compose Host Preparation deployment script", () => {
      let expected =
        scripts.remote(
          instanceDef.deployment.host.value,
          scripts.gitClone(
            instanceDef.deployment.value.gitUrl,
            path
              .resolve(
                instanceDef.deployment.hostDir,
                instanceDef.name,
                "bahmni_docker"
              )
              .toString(),
            instanceDef.deployment.value.commitId
          )
        ) +
        "\n" +
        scripts.remote(
          instanceDef.deployment.host.value,
          scripts.createEnvVarFile(instanceDef)
        ) +
        "\n" +
        scripts.remote(
          instanceDef.deployment.host.value,
          "cd " +
            path
              .resolve(
                instanceDef.deployment.hostDir,
                instanceDef.name,
                "bahmni_docker"
              )
              .toString() +
            " && docker-compose -p " +
            instanceDef.name +
            " --env-file=" +
            path
              .resolve(
                instanceDef.deployment.hostDir,
                instanceDef.name,
                instanceDef.name + ".env"
              )
              .toString() +
            " build --pull proxy openmrs mysql" +
            "\n"
        ) +
        scripts.remote(
          instanceDef.deployment.host.value,
          "sudo chown -R root:root " +
            path
              .resolve(instanceDef.deployment.hostDir, instanceDef.name)
              .toString()
        );
      expect(
        dockerCompose.hostPreparation.getDeploymentScript(instanceDef)
      ).toEqual(expected);
    });

    it("should generate docker compose Host Preparation data script", () => {
      expect(dockerCompose.hostPreparation.getDataScript(instanceDef)).toEqual(
        ""
      );
    });

    it("should generate docker compose Host Preparation artifacts script", () => {
      expect(
        dockerCompose.hostPreparation.getArtifactsScript(instanceDef)
      ).toEqual("");
    });

    it("should generate docker compose Start Instance deployment script", () => {
      expect(
        dockerCompose.startInstance.getDeploymentScript(instanceDef)
      ).toEqual(
        scripts.remote(
          instanceDef.deployment.host.value,
          "cd /var/docker-volumes/" +
            instanceDef.name +
            "/bahmni_docker && " +
            "docker-compose -p " +
            instanceDef.name +
            " --env-file=/var/docker-volumes/" +
            instanceDef.name +
            "/" +
            instanceDef.name +
            ".env up -d proxy openmrs mysql"
        )
      );
    });

    it("should generate docker compose Start Instance data script", () => {
      expect(dockerCompose.startInstance.getDataScript(instanceDef)).toEqual(
        ""
      );
    });

    it("should generate docker compose Start Instance artifacts script", () => {
      expect(
        dockerCompose.startInstance.getArtifactsScript(instanceDef)
      ).toEqual("");
    });
  });
});