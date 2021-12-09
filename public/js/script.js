// STARTING CODE FOR THE startThreeJS() FUNCTION TAKEN FROM https://codepen.io/shshaw/pen/yPPOEg and then heavily modified

window.onload = function () {
  let clientSocket = io.connect("http://0.0.0.0:5000");
  let socketId = -1;

  clientSocket.on("connect", function (data) {
    clientSocket.emit("requestData");
    clientSocket.on("new_data", function (results) {
      // GAME CODE
      let currentTool = 0;
      let oldTool = 0;
      let wheelAllowed = true; // reduces the speed of the wheel to change tools to prevent available tile spaces from remaining when leaving the Tile tool
      let currentUsername = localStorage.getItem("username");
      let playerCurrency;
      let controls, flyControls;
      let renderer, camera, scene, raycaster, mouse, loader;
      let tiles = [];
      let tilePlacements = [];
      let tilePlacementsDisplayed = false;
      let tileOwnersDisplayed = false;
      let otherModels = [];
      let ownerMarkers = [];
      let state = `menu`; // menu, game
      let tilesetSize = 1;
      let selectedTile;
      let tilesClickable = true;
      let currentTileType = 0;
      let oldTileType = 0;
      let tileType = "mountain"; // mountain, forest, desert, water
      let tilePath = "../assets/models/mountain.gltf";
      let tileCost = 3;
      let serverData = results;

      let occupied1 = false;
      let occupied2 = false;
      let occupied3 = false;
      let occupied4 = false;
      let occupied5 = false;
      let occupied6 = false;

      const HEX_FLATS = 1.732;
      const HEX_CORNERS = 2;

      const CLAIM_COST = 5;

      if (localStorage.getItem("playerCurrency")) {
        playerCurrency = localStorage.getItem("playerCurrency");
      } else {
        playerCurrency = 12;
      }

      clientSocket.emit("updateCurrency");

      document.querySelector(".currency p").innerText = playerCurrency;

      startThreeJS();

      let audio = new Audio("../assets/sounds/music.mp3");
      audio.loop = true;

      document.addEventListener("click", function () {
        audio.play();
      });

      clientSocket.on("returnTileToClient", function (data) {
        addModel(
          data.tileType,
          data.path,
          data.x,
          data.y,
          data.z,
          tiles,
          data.color,
          false,
          data.owner
        );
      });

      clientSocket.on("returnColorToClient", function (colorChangeTarget) {
        for (let i = 0; i < scene.children.length; i++) {
          if (
            scene.children[i].x === colorChangeTarget.x &&
            scene.children[i].y === colorChangeTarget.y &&
            scene.children[i].z === colorChangeTarget.z
          ) {
            for (
              let j = 0;
              j < scene.children[i].children[2].children[0].children.length;
              j++
            ) {
              scene.children[i].children[2].children[0].children[
                j
              ].material = new THREE.MeshPhysicalMaterial({
                color: colorChangeTarget.color,
                emissiveIntensity: 0,
              });
            }

            setTimeout(function () {
              tilesClickable = true;
            }, 100);
          }
        }

        document.querySelector(".popup").className = "popup";
      });

      clientSocket.on("returnTileClaim", function (claimTarget) {
        for (let i = 0; i < tiles.length; i++) {
          if (
            tiles[i].x === claimTarget.x &&
            tiles[i].y === claimTarget.y &&
            tiles[i].z === claimTarget.z
          ) {
            tiles[i].owner = claimTarget.owner;
          }
        }

        document.querySelector(".popup").className = "popup";
      });

      clientSocket.on("giveCurrency", function (currencyGainAmount) {
        let currencyGains = JSON.parse(localStorage.getItem("currencyGains"));

        if (currencyGains) {
          newGainAmount = JSON.parse(currencyGainAmount) - currencyGains;
          localStorage.setItem("currencyGains", JSON.parse(currencyGainAmount));

          for (let i = 0; i < newGainAmount; i++) {
            playerCurrency = JSON.parse(playerCurrency) + 6;
          }
        } else {
          currencyGains = JSON.parse(currencyGainAmount);
          localStorage.setItem("currencyGains", currencyGains);

          for (let i = 0; i < currencyGains; i++) {
            playerCurrency = JSON.parse(playerCurrency) + 6;
          }
        }
        localStorage.setItem("playerCurrency", playerCurrency);
        document.querySelector(".currency p").innerText = playerCurrency;
      });

      document.addEventListener("keyup", function () {
        if (event.keyCode === 13) {
          startGame();
        }
      });

      document
        .querySelector(".form button")
        .addEventListener("click", startGame);
      document
        .querySelector(".color1")
        .addEventListener("click", changeTileColor);
      document
        .querySelector(".color2")
        .addEventListener("click", changeTileColor);
      document
        .querySelector(".color3")
        .addEventListener("click", changeTileColor);
      document
        .querySelector(".clear")
        .addEventListener("click", changeTileColor);

      document.querySelector(".confirm").addEventListener("click", claimTile);
      document.querySelector(".cancel").addEventListener("click", function () {
        document.querySelector(".popup").classList.remove("territoryTool");
        controls.enabled = true;
        setTimeout(function () {
          tilesClickable = true;
        }, 100);
      });

      document.addEventListener("click", function () {
        // RAYCASTING
        event.preventDefault();

        mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        if (tilePlacementsDisplayed) {
          let collisionedObjects = raycaster.intersectObjects(
            tilePlacements,
            true
          );

          if (collisionedObjects.length > 0) {
            if (playerCurrency >= 2) {
              let tileToSend = {
                tileType: tileType,
                path: tilePath,
                x: collisionedObjects[0].object.x,
                y: collisionedObjects[0].object.y,
                z: collisionedObjects[0].object.z,
                color: "rgb(68, 68, 68)",
                owner: undefined,
              };

              let currencyGains = JSON.parse(
                localStorage.getItem("currencyGains")
              );
              currencyGains++;
              localStorage.setItem("currencyGains", JSON.parse(currencyGains));

              //send to tile server,refresh, and save
              clientSocket.emit("sendTileToServer", tileToSend);
              clientSocket.emit("dataFromClient", tileToSend);

              playerCurrency -= tileCost;
              localStorage.setItem("playerCurrency", playerCurrency);
              tilesetSize++;
              localStorage.setItem("tilesetSize", tilesetSize);

              document.querySelector(".currency p").innerText = playerCurrency;

              // update available tile placement spaces
              setTimeout(function () {
                for (let i = 0; i < tiles.length; i++) {
                  if (
                    tiles[i].x === collisionedObjects[0].object.x &&
                    tiles[i].z === collisionedObjects[0].object.z
                  ) {
                    displayAvailableTilePlacements(tiles[i]);
                  }
                }

                for (let i = 0; i < tilePlacements.length; i++) {
                  if (
                    tilePlacements[i].x === collisionedObjects[0].object.x &&
                    tilePlacements[i].z === collisionedObjects[0].object.z
                  ) {
                    scene.remove(tilePlacements[i]);
                    tilePlacements.splice(
                      tilePlacements.indexOf(tilePlacements[i]),
                      1
                    );
                  }
                }
              }, 50);
            } else {
              alert("Insufficient currency");
            }
          }
        }

        // TERRITORY TOOL
        if (currentTool === 2 && tilesClickable) {
          let collisionedObjects = raycaster.intersectObjects(tiles, true);

          if (
            collisionedObjects.length > 0 &&
            (collisionedObjects[0].object.tileType === "other" ||
              collisionedObjects[0].object.owner)
          ) {
            alert("Cannot claim this tile!");
          } else if (collisionedObjects.length > 0) {
            let currentEvent = event;

            setTimeout(function () {
              document.querySelector(".popup").classList.add("territoryTool");

              document.querySelector(".popup").style.position = "absolute";
              document.querySelector(".popup").style.top =
                currentEvent.clientY - 38 + "px";
              document.querySelector(".popup").style.left =
                currentEvent.clientX - 36 + "px";

              selectedTile = collisionedObjects[0];
              tilesClickable = false;
              controls.enabled = false;
            }, 50);
          }
        }

        // PAINT TOOL
        if (currentTool === 3 && tilesClickable) {
          let collisionedObjects = raycaster.intersectObjects(tiles, true);

          if (
            collisionedObjects.length > 0 &&
            (collisionedObjects[0].object.tileType === "other" ||
              (collisionedObjects[0].object.owner &&
                collisionedObjects[0].object.owner !== currentUsername))
          ) {
            alert("Cannot edit this tile!");
          } else if (collisionedObjects.length > 0) {
            let currentEvent = event;
            setTimeout(function () {
              document.querySelector(".popup").classList.add("paintTool");

              document.querySelector(".popup").style.position = "absolute";
              document.querySelector(".popup").style.top =
                currentEvent.clientY - 38 + "px";
              document.querySelector(".popup").style.left =
                currentEvent.clientX - 36 + "px";

              if (collisionedObjects[0].object.tileType === "mountain") {
                document.querySelector(".color1").style.backgroundColor =
                  "#F16D23";
                document.querySelector(".color2").style.backgroundColor =
                  "#ACA08B";
                document.querySelector(".color3").style.backgroundColor =
                  "#635D59";
              } else if (collisionedObjects[0].object.tileType === "forest") {
                document.querySelector(".color1").style.backgroundColor =
                  "#479453";
                document.querySelector(".color2").style.backgroundColor =
                  "#A1E797";
                document.querySelector(".color3").style.backgroundColor =
                  "#F3B924";
              } else if (collisionedObjects[0].object.tileType === "desert") {
                document.querySelector(".color1").style.backgroundColor =
                  "#DB8251";
                document.querySelector(".color2").style.backgroundColor =
                  "#6BAE76";
                document.querySelector(".color3").style.backgroundColor =
                  "#FCEFD3";
              } else if (collisionedObjects[0].object.tileType === "water") {
                document.querySelector(".color1").style.backgroundColor =
                  "#569CB6";
                document.querySelector(".color2").style.backgroundColor =
                  "#46B2AC";
                document.querySelector(".color3").style.backgroundColor =
                  "#304D9A";
              }

              selectedTile = collisionedObjects[0];
              tilesClickable = false;
              controls.enabled = false;
            }, 50);
          }
        }
      });

      if (currentUsername) {
        document.querySelector(".titleScreen").classList.add("removed");
        document.querySelector("header h3").innerText = currentUsername;
        startGame();
      }

      // TOOLBAR NAVIGATION
      for (let i = 0; i < document.querySelectorAll(".tool").length; i++) {
        document
          .querySelectorAll(".tool")
          [i].addEventListener("click", function () {
            oldTool = currentTool;

            if (currentTool === 1) {
              // remove available tile placement indicators
              for (let i = 0; i < tilePlacements.length; i++) {
                scene.remove(tilePlacements[i]);
              }
              tilePlacements = [];
              document.getElementsByClassName("tileSelection")[0].style.bottom =
                "-120px";
              tilePlacementsDisplayed = false;
            } else if (currentTool === 2 || currentTool === 3) {
              for (let i = 0; i < ownerMarkers.length; i++) {
                scene.remove(ownerMarkers[i]);
              }
              ownerMarkers = [];
              tileOwnersDisplayed = false;
            }

            if (currentTool === 4) {
              controls.dispose();
              setOrbitControls();
              controls.enabled = true;
            }

            if (event.target.dataset.index !== undefined) {
              currentTool = parseInt(event.target.dataset.index);
              displayToolUI();
            } else {
              currentTool = parseInt(event.target.parentNode.dataset.index);
              displayToolUI();
            }

            if (currentTool === 4) {
              controls.dispose();
              setFlyControls();
              controls.enabled = true;
            }

            selectTool();
          });
      }

      // TILE TYPE NAVIGATION
      document.getElementsByClassName("tileTypes")[0].style.left = "-50px";
      document.getElementsByClassName("tileSelection")[0].style.bottom =
        "-120px";

      for (let i = 0; i < document.querySelectorAll(".tileType").length; i++) {
        document
          .querySelectorAll(".tileType")
          [i].addEventListener("click", function () {
            oldTileType = currentTileType;

            if (event.target.classList.length === 1) {
              currentTileType = i;
              tileType = event.target.className;
              tilePath = event.target.dataset.path;
              tileCost = event.target.dataset.cost;
            }

            // Set tile type list horizontal alignment
            let currentMarginLeft = document.getElementsByClassName(
              "tileTypes"
            )[0].style.left;

            document.getElementsByClassName(
              "tileTypes"
            )[0].style.left = `calc(${currentMarginLeft} - ${
              112 * (currentTileType - oldTileType)
            }px)`;
          });
      }

      document.addEventListener("keydown", function () {
        oldTool = currentTool;

        if (event.keyCode === 49) {
          if (currentTool === 4) {
            controls.dispose();
            setOrbitControls();
            controls.enabled = true;
          }

          currentTool = 0;
          displayToolUI();
        } else if (event.keyCode === 50) {
          if (currentTool === 4) {
            controls.dispose();
            setOrbitControls();
            controls.enabled = true;
          }

          currentTool = 1;
          displayToolUI();
        } else if (event.keyCode === 51) {
          if (currentTool === 4) {
            controls.dispose();
            setOrbitControls();
            controls.enabled = true;
          }

          currentTool = 2;
          displayToolUI();
        } else if (event.keyCode === 52) {
          if (currentTool === 4) {
            controls.dispose();
            setOrbitControls();
            controls.enabled = true;
          }

          currentTool = 3;
          displayToolUI();
        } else if (event.keyCode === 53) {
          currentTool = 4;
          displayToolUI();
          controls.dispose();
          setFlyControls();
          controls.enabled = true;
        }

        selectTool();
      });

      document.getElementsByClassName("tools")[0].style.marginTop = "-58px";

      function startGame() {
        if (!currentUsername) {
          localStorage.setItem(
            "username",
            document.querySelector("input").value
          );
        }

        fadeOut(document.getElementsByClassName("titleScreen")[0]);
        currentUsername = localStorage.getItem("username");
        document.querySelector("header h3").innerText = currentUsername;

        controls.enabled = true;
        state = `game`;
      }

      function selectTool() {
        // Unhighlight old tool
        for (let i = 0; i < document.querySelectorAll(`.tool`).length; i++) {
          fadeIn(document.querySelectorAll(`img`)[i * 2 + 1]);
          document
            .querySelectorAll(`img`)
            [(i + 1) * 2].classList.add("removed");
        }

        // Highlight new tool
        fadeIn(document.querySelectorAll(`img`)[(currentTool + 1) * 2]);
        document
          .querySelectorAll(`img`)
          [(currentTool + 1) * 2 - 1].classList.add("removed");

        // Set tool bar vertical alignment
        let currentMarginTop = document.getElementsByClassName("tools")[0].style
          .marginTop;
        document.getElementsByClassName(
          "tools"
        )[0].style.marginTop = `calc(${currentMarginTop} - ${
          84 * (currentTool - oldTool)
        }px)`;
      }

      function fadeIn(target) {
        target.classList.add("transitioning");
        target.classList.remove("hidden");
        target.classList.remove("removed");
      }

      function fadeOut(target) {
        target.classList.add("transitioning");
        target.classList.add("hidden");

        setTimeout(function () {
          target.classList.add("removed");
        }, 400);
      }

      function addModel(
        tileType,
        path,
        x,
        y,
        z,
        array,
        color = "rgb(68, 68, 68)",
        addToDatabase = false,
        owner = undefined
      ) {
        loader.load(path, function (data) {
          data.scene.traverse(function (child) {
            if (child.isMesh) {
              child.color = color;
              child.tileType = tileType;
              child.path = path;
              child.x = x;
              child.y = y;
              child.z = z;
              child.owner = owner;

              if (color) {
                child.material = new THREE.MeshPhysicalMaterial({
                  color: color,
                  emissiveIntensity: 0,
                });
              }
            }
          });

          let object = data.scene;

          object.position.set(x, y, z);
          object.color = color;
          object.tileType = tileType;
          object.path = path;
          object.x = x;
          object.y = y;
          object.z = z;
          object.owner = owner;

          scene.add(object);
          array.push(object);
        });

        let tileToSend = {
          tileType: tileType,
          path: path,
          x: x,
          y: y,
          z: z,
          color: color,
          owner: owner,
        };

        if (addToDatabase) {
          clientSocket.emit("dataFromClient", tileToSend);
        }
      }

      function displayToolUI() {
        // display TILE tool UI
        if (currentTool === 1 && !tilePlacementsDisplayed) {
          setTimeout(function () {
            for (let i = 0; i < tiles.length; i++) {
              displayAvailableTilePlacements(tiles[i]);
            }
          }, 50);

          document.getElementsByClassName("tileSelection")[0].style.bottom =
            "20px";
          tilePlacementsDisplayed = true;
        } else if (
          (currentTool === 2 && !tileOwnersDisplayed) ||
          (currentTool === 3 && !tileOwnersDisplayed)
        ) {
          displayOwnership();
        } else if (
          event.keyCode >= 49 &&
          event.keyCode <= 53 &&
          tilePlacementsDisplayed
        ) {
          for (let i = 0; i < tilePlacements.length; i++) {
            scene.remove(tilePlacements[i]);
          }
          tilePlacements = [];
          document.getElementsByClassName("tileSelection")[0].style.bottom =
            "-120px";
          tilePlacementsDisplayed = false;
        }
      }

      function displayAvailableTilePlacements(target) {
        occupied1 = false;
        occupied2 = false;
        occupied3 = false;
        occupied4 = false;
        occupied5 = false;
        occupied6 = false;

        for (let j = 0; j < tiles.length; j++) {
          // FIRST ADJACENT TILE
          if (
            tiles[j].x === target.x + HEX_FLATS &&
            tiles[j].z === target.z + 1
          ) {
            occupied1 = true;
          }

          // SECOND ADJACENT TILE
          if (
            tiles[j].x === target.x - HEX_FLATS &&
            tiles[j].z === target.z + 1
          ) {
            occupied2 = true;
          }

          // THIRD ADJACENT TILE
          if (
            tiles[j].x === target.x &&
            tiles[j].z === target.z + HEX_CORNERS
          ) {
            occupied3 = true;
          }

          // FOURTH ADJACENT TILE
          if (
            tiles[j].x === target.x &&
            tiles[j].z === target.z - HEX_CORNERS
          ) {
            occupied4 = true;
          }

          // FIFTH ADJACENT TILE
          if (
            tiles[j].x === target.x - HEX_FLATS &&
            tiles[j].z === target.z - HEX_CORNERS / 2
          ) {
            occupied5 = true;
          }

          // SIXTH ADJACENT TILE
          if (
            tiles[j].x === target.x + HEX_FLATS &&
            tiles[j].z === target.z - HEX_CORNERS / 2
          ) {
            occupied6 = true;
          }
        }

        if (!occupied1) {
          addModel(
            "water",
            "../assets/models/tileSlot.gltf",
            target.x + HEX_FLATS,
            0,
            target.z + 1,
            tilePlacements,
            false
          );
        }

        if (!occupied2) {
          addModel(
            "water",
            "../assets/models/tileSlot.gltf",
            target.x - HEX_FLATS,
            0,
            target.z + 1,
            tilePlacements,
            false
          );
        }

        if (!occupied3) {
          addModel(
            "water",
            "../assets/models/tileSlot.gltf",
            target.x,
            0,
            target.z + HEX_CORNERS,
            tilePlacements,
            false
          );
        }

        if (!occupied4) {
          addModel(
            "water",
            "../assets/models/tileSlot.gltf",
            target.x,
            0,
            target.z - HEX_CORNERS,
            tilePlacements,
            false
          );
        }

        if (!occupied5) {
          addModel(
            "water",
            "../assets/models/tileSlot.gltf",
            target.x - HEX_FLATS,
            0,
            target.z - HEX_CORNERS / 2,
            tilePlacements,
            false
          );
        }

        if (!occupied6) {
          addModel(
            "water",
            "../assets/models/tileSlot.gltf",
            target.x + HEX_FLATS,
            0,
            target.z - HEX_CORNERS / 2,
            tilePlacements,
            false
          );
        }
      }

      function displayOwnership() {
        for (let i = 0; i < tiles.length; i++) {
          if (tiles[i].owner) {
            let ownerColor;
            if (tiles[i].owner === currentUsername) {
              ownerColor = "rgb(231, 218, 119)";
            } else {
              ownerColor = "rgb(68, 68, 68)";
            }
            addModel(
              tiles[i].tileType,
              "../assets/models/owned.glb",
              tiles[i].x,
              tiles[i].y + 0.2,
              tiles[i].z,
              ownerMarkers,
              ownerColor,
              false
            );
          }
        }

        tileOwnersDisplayed = true;
      }

      function changeTileColor() {
        let colorChangeTarget = selectedTile.object.parent.parent.parent;
        let gameColor;

        if (
          event.target.style.backgroundColor === "" ||
          event.target.style.backgroundColor === "#ffffff"
        ) {
          gameColor = "rgb(68,68,68)";
        } else {
          gameColor = event.target.style.backgroundColor;
        }

        // broadcast the new color to all clients
        clientSocket.emit("sendColorToServer", {
          x: colorChangeTarget.x,
          y: colorChangeTarget.y,
          z: colorChangeTarget.z,
          color: gameColor,
        });

        // save new color to the server
        clientSocket.emit("updateColor", {
          x: colorChangeTarget.x,
          y: colorChangeTarget.y,
          z: colorChangeTarget.z,
          color: gameColor,
        });

        controls.enabled = true;

        setTimeout(function () {
          tilesClickable = true;
        }, 100);
      }

      function claimTile() {
        let claimTarget = selectedTile.object.parent.parent.parent;

        if (playerCurrency >= CLAIM_COST) {
          // broadcast the new tile owner to all clients
          clientSocket.emit("sendTileClaim", {
            x: claimTarget.x,
            y: claimTarget.y,
            z: claimTarget.z,
            owner: currentUsername,
          });

          // save tile owner to the server
          clientSocket.emit("claimTile", {
            x: claimTarget.x,
            y: claimTarget.y,
            z: claimTarget.z,
            owner: currentUsername,
          });

          playerCurrency -= CLAIM_COST;
          localStorage.setItem("playerCurrency", playerCurrency);
          document.querySelector(".currency p").innerText = playerCurrency;

          setTimeout(function () {
            displayOwnership();
          }, 50);
        } else {
          alert("Insufficient currency");
        }

        document.querySelector(".popup").classList.remove("territoryTool");
        controls.enabled = true;
        setTimeout(function () {
          tilesClickable = true;
        }, 100);
      }

      function setOrbitControls() {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enabled = false;
        controls.enableZoom = true;
        controls.enableDamping = false;
        controls.dampingFactor = 0.2;
      }

      function setFlyControls() {
        controls = new THREE.FlyControls(camera, renderer.domElement);
        controls.enabled = false;

        controls.movementSpeed = 10;
        controls.domElement = renderer.domElement;
        controls.rollSpeed = Math.PI / 6;
        controls.autoForward = false;
        controls.enableZoom = false;

        controls.dragToLook = true;
      }

      function startThreeJS() {
        // STARTING CODE TAKEN FROM https://codepen.io/shshaw/pen/yPPOEg and then heavily modified

        const backgroundColor = 0x15131a;

        /*////////////////////////////////////////*/

        let renderCalls = [];
        function render() {
          requestAnimationFrame(render);
          renderCalls.forEach((callback) => {
            callback();
          });
        }
        render();

        /*////////////////////////////////////////*/

        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(
          75,
          window.innerWidth / window.innerHeight,
          0.1,
          1000
        );

        camera.position.set(0, 5, 10); // BREAKS THE CAMERA IF USING FLYCONTROLS, NECESSARY IF USING controls

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(backgroundColor); //0x );

        renderer.toneMapping = THREE.LinearToneMapping;
        renderer.toneMappingExposure = Math.pow(0.94, 5.0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;

        document.body.appendChild(renderer.domElement);

        function renderScene() {
          renderer.render(scene, camera);
        }
        renderCalls.push(renderScene);

        /* ////////////////////////////////////////////////////////////////////////// */

        renderCalls.push(function () {
          if (controls.enabled) {
            controls.update(0.01);
          }
        });

        setOrbitControls();

        /* ////////////////////////////////////////////////////////////////////////// */

        var light = new THREE.PointLight("rgb(68, 68, 68)", 5, 100);
        light.position.set(4, 30, -20);
        scene.add(light);

        var light2 = new THREE.AmbientLight(0x202020, 10, 0.5);
        light2.position.set(30, -10, 30);
        scene.add(light2);

        /* ////////////////////////////////////////////////////////////////////////// */

        loader = new THREE.GLTFLoader();
        loader.crossOrigin = true;

        tilesetSize = serverData.length;

        if (tilesetSize) {
          let tileset = [];

          for (let i = 0; i < tilesetSize; i++) {
            tileset[i] = serverData[i];
          }

          for (let i = 0; i < tilesetSize; i++) {
            if (tileset[i]) {
              addModel(
                tileset[i].tileType,
                tileset[i].path,
                tileset[i].x,
                tileset[i].y,
                tileset[i].z,
                tiles,
                tileset[i].color,
                false,
                tileset[i].owner
              );
            }
          }
        } else {
          tilesetSize = 1;
        }

        addModel(
          "other",
          "../assets/models/desert.gltf",
          0,
          0,
          0,
          tiles,
          "rgb(231, 218, 119)",
          false
        );

        addModel(
          "other",
          "../assets/models/tree.gltf",
          0,
          0.08,
          0,
          otherModels,
          "rgb(61, 116, 67)",
          false
        );

        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
      }
    }); // new_data from socket
  }); // cientSocket
};
