import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
// import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-analytics.js";
import { getAuth, signInAnonymously, onAuthStateChanged} from "https://www.gstatic.com/firebasejs/9.9.3/firebase-auth.js"
import { getDatabase , ref , onChildAdded, onChildRemoved, set , onDisconnect, update,
     onValue, push, remove, get, serverTimestamp} from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js"
import { faker } from 'https://cdn.skypack.dev/@faker-js/faker';

const firebaseConfig = {
  apiKey: "AIzaSyDAb9yaEst1XlJY3hhu7MgbL5OnfqEhhvA",
  authDomain: "quadrafight.firebaseapp.com",
  databaseURL: "https://quadrafight-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "quadrafight",
  storageBucket: "quadrafight.appspot.com",
  messagingSenderId: "11767354143",
  appId: "1:11767354143:web:f6a3e18847b91b9741162a",
  measurementId: "G-XZZK7D3F3Y"
};


(function () {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getDatabase();

    const isColorCodesFree = {"0x0": true, "0x6": true, "14x0": true, "14x6": true};
    const availableColorCodes = ["0x0", "0x6", "14x0", "14x6"];
    const laserReload = 5000;
    const moveReload = 400;
    const winWhRatio = 310 / 113;
    const players = {};
    const usedNames = new Set();        // not implemented, maybe in the future

    const colorPink = '#e883c8';
    const colorYellow = '#ffe365';
    const colorGreen = '#8cd655';
    const colorPurple = '#9f79ea';
    
    let myUid;
    let myPlayerRef;
    let myUserRef;
    let myName = faker.name.firstName();
    let connected;
    let inGame = false;
    let myColorIndex = 0; 
    let myColorCode = "0x0";
    let areKeysActive = true;
    let myArrowElement;
    let infoDisplayed = false;

    const playersRef = ref(db, "players");
    const lasersRef = ref(db, "lasers");
    const spawnPosRef = ref(db, "freeSpawnPos");
    const messagesRef = ref(db, "messages");
    const usersRef = ref(db, "users");
    
    const gameWindowElement = document.getElementById('gameWindow');
    const mapElement = document.getElementById("map");
    const nameInputElement = document.getElementById("nameInput");
    const msgInputElement = document.getElementById("msgType");
    const msgListElement = document.querySelector("#chat form ul");
    const overflowHandlerElement = document.getElementById("overflowHandler");
    const colorButtonElement = document.getElementById("colorButton");
    const errorMessageElement = document.getElementById("errorMessage");
    const laserElements = {};
    const playerElements = {};
    
    document.querySelector("#pcInfo button").addEventListener('click', (e) => {
        e.preventDefault();
        const pcInfoPopupElement = document.querySelector("#pcInfo div");
        if (infoDisplayed){
            pcInfoPopupElement.style.setProperty('display', 'none');
        }
        else{
            pcInfoPopupElement.style.setProperty('display', 'block');
        }
        infoDisplayed = !infoDisplayed;
    })

    function checkActive(){
        return document.activeElement !== nameInputElement && document.activeElement !== msgInputElement
    }

    const callback = {
        "KeyW":      () => { if (checkActive())       turn([0, -1])},
        "KeyS":      () => { if (checkActive())       turn([0, 1])},
        "KeyA":      () => { if (checkActive())       turn([-1, 0])},
        "KeyD":      () => { if (checkActive())       turn([1, 0])},
        "ArrowUp":   () => { if (checkActive())       move(1)},
        "ArrowDown": () => { if (checkActive())       move(-1)},
        "Space":     () => { if (checkActive())       shootLaser()}};
    const lastPressed = {
        "KeyW":      0,
        "KeyS":      0,
        "KeyA":      0,
        "KeyD":      0,
        "ArrowUp":   0,
        "ArrowDown": 0,
        "Space":     0
    };
    const pressReload = {
        "KeyW":      0,
        "KeyS":      0,
        "KeyA":      0,
        "KeyD":      0,
        "ArrowUp":   `${moveReload}`,
        "ArrowDown": `${moveReload}`,
        "Space":     `${laserReload}`
    };
    const playerData = {
        "0x0": {
            x : 0,
            y : 0,
            color : 'pink',
            direction : 'right',
            facing : [1, 0],
        },
        "0x6": {
            x : 0,
            y : 6,
            color : 'yellow',
            direction : 'right',
            facing : [1, 0],
        },
        "14x0": {
            x : 14,
            y : 0,
            color : 'green',
            direction : 'left',
            facing : [-1, 0],
        },
        "14x6": {
            x : 14,
            y : 6,
            color : 'purple',
            direction : 'left',
            facing : [-1, 0],
        }
    };
    const mapSize = [15, 7];
    const map = [
        [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0],
        [1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 1],
        [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        [0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0],
        [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        [1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 1],
        [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0]
    ];
    const playersPositions = [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ];

    // moblie buttons setup
    const buttonElements = {
        turnControls: {
            btnLeft: document.querySelector(".turnControls .btnLeft"),
            btnUp: document.querySelector(".turnControls .btnUp"),
            btnDown: document.querySelector(".turnControls .btnDown"),
            btnRight: document.querySelector(".turnControls .btnRight"),
        },
        actionControls: {
            btnUp: document.querySelector(".actionControls .btnUp"),
            btnDown: document.querySelector(".actionControls .btnDown"),
            btnFire: document.querySelector(".actionControls .btnFire"),
        }
    };
    const buttonCode = {
        turnControls: {
            btnLeft: "KeyA",
            btnUp: "KeyW",
            btnDown: "KeyS",
            btnRight: "KeyD",
        },
        actionControls: {
            btnUp: "ArrowUp",
            btnDown: "ArrowDown",
            btnFire: "Space",
        }
    };
    for(let category in buttonElements){
        for(let buttonType in buttonElements[category]){
            buttonElements[category][buttonType].addEventListener('click', (event) => {
                event.preventDefault();
                validatePress(buttonCode[category][buttonType]);
            });
        }
    }

    
    scaleMap();
    window.addEventListener('resize', scaleMap);
    function scaleMap(){
        let WhRatio = window.innerWidth / window.innerHeight;
        if (WhRatio > winWhRatio){
            gameWindowElement.style.setProperty('height', `${window.innerHeight}px`);
            gameWindowElement.style.setProperty('width', `${window.innerHeight * winWhRatio}px`);
        }
        else{
            gameWindowElement.style.setProperty('height', `${window.innerWidth * (1 / winWhRatio)}px`);
            gameWindowElement.style.setProperty('width', `${window.innerWidth}px`);
        }
    }

    function validatePress(keyCode){
        const currTime = new Date().getTime();
        if (currTime - lastPressed[keyCode] > pressReload[keyCode]){
            callback[keyCode]();
            lastPressed[keyCode] = currTime;
        }
    };
    document.addEventListener('keydown', (event) => {
        if (areKeysActive && event.code in pressReload){
            validatePress(event.code);
        }
    })
    
    nameInputElement.value = myName;
    nameInputElement.addEventListener('change', () => {
        myName = nameInputElement.value || faker.name.firstName();
            update(myUserRef, {name: myName});
    })

    colorButtonElement.addEventListener('click', (e) => { 
        e.preventDefault();
        if(!inGame && connected){
            myColorIndex = (myColorIndex + 1) % availableColorCodes.length;
        }
        myColorCode = availableColorCodes[myColorIndex];
        switch (myColorCode){
            case "0x0":
                colorButtonElement.style.setProperty("background-color", colorPink);
                break;
            case "0x6":
                colorButtonElement.style.setProperty("background-color", colorYellow);
                break;
            case "14x0":
                colorButtonElement.style.setProperty("background-color", colorGreen);
                break;
            case "14x6":
                colorButtonElement.style.setProperty("background-color", colorPurple);
                break;
        }
    });
    
    document.getElementById("respawnButton").addEventListener('click', (e) => {
        e.preventDefault();
        if(!inGame && connected){
            myPlayerRef = spawnMyPlayer(myUid);
            if (myPlayerRef !== null){
                areKeysActive = true;
                const updateObject = {};
                updateObject[myColorCode] = true;
                onDisconnect(spawnPosRef).update(updateObject);
                onDisconnect(myPlayerRef).remove();
                inGame = true;
                nameInputElement.disabled = true;
            }
            else{
                errorMessageElement.style.setProperty('display', 'block');
            }
        }
    });

    errorMessageElement.querySelector("button").addEventListener('click', () => {
        errorMessageElement.style.setProperty('display', 'none');
    });

    document.querySelector("#chat form").addEventListener("submit", (event) => {
        event.preventDefault();
        if(msgInputElement.value){
            let color;
            if (myPlayerRef){
                color = players[myUid].color;
            }
            else{
                color = "grey";
            }
            const newKey = push(messagesRef);
            set(newKey, {
                content: msgInputElement.value,
                id: myUid,
                name: myName,
                color,
                time: serverTimestamp(),
            });
            msgInputElement.value = "";
        }
    })

    get(usersRef).then((snapshot) => {
        let flag = true;
        for(let key in snapshot.val()){
            if (key !== myUid){
                flag = false;
                break;
            }
        }
        if (flag){
            set(messagesRef, null);
            while (msgListElement.children.length){
                msgListElement.removeChild(msgListElement.children[0]);
            } 
        }
        msgListElement.style.setProperty('display', 'list-item');
    }).catch((error) => console.log(error));


    onChildAdded(usersRef, (snapshot) => {
        usedNames.add(snapshot.val().name);
        const playerKey = snapshot.key;
        onValue(ref(db, "users/" + playerKey + "/name"), (snapshot) => {
            const data = snapshot.val();
            if (data !== null && players[playerKey]){
                usedNames.delete(players[playerKey].name);
                usedNames.add(data);
            }
        });
    });

    onChildRemoved(usersRef, (snapshot) => {
        usedNames.delete(snapshot.val().name);
    });

    onChildAdded(messagesRef, (snapshot) => {
        const data = snapshot.val();
        const newElement = document.createElement('li');
        let nameTag;
        if(data.id === myUid){
            nameTag = "You";
        }
        else{
            nameTag = data.name;
        }
        newElement.innerHTML = `
            <span class="name">${nameTag}</span>
            <p>: ${data.content}</p>`;
        const nameTagElement = newElement.querySelector('span');
        nameTagElement.style.setProperty("background-color", data.color);
        msgListElement.appendChild(newElement);
        overflowHandlerElement.scrollTop = overflowHandlerElement.scrollHeight;
    })


    // players
    onValue(spawnPosRef, (snapshot) => {
        const dict = snapshot.val();
        for (let key in dict){
            isColorCodesFree[key] = dict[key]
        }
    });

    onChildAdded(playersRef, (snapshot) => {
        const newPlayerData = snapshot.val();
        const newPlayerID = snapshot.key;
        const newElement = document.createElement('div');
        newElement.classList.add("player");
        newElement.innerHTML = `
        <span class=nameTag>NamE</span>
        <div class=playerSprite>
            <img src="./images/tanks.png">
        </div>`;
        if (newPlayerID === myUid){
            newElement.innerHTML += 
                `<img id="arrow" width="7px" height="5px" src="./images/arrow.png">`;
            myArrowElement = newElement.querySelector("#arrow");
        }
        mapElement.appendChild(newElement);
        playerElements[newPlayerID] = newElement;
        updatePlayer(newPlayerID, newPlayerData);

        onValue(ref(db, `players/${newPlayerID}`), (snapshot) => {
            if (snapshot.val() !== null){
                updatePlayer(snapshot.key, snapshot.val());
            }
        });
    })
    
    onChildRemoved(playersRef, (snapshot) => {
        const data = snapshot.val();
        playersPositions[data.y][data.x] = 0;
        const rmPlayerId = snapshot.key;
        if (rmPlayerId === myUid){
            inGame = false;
            nameInputElement.disabled = false;
            const updateObject = {};
            updateObject[myColorCode] = true;
            update(spawnPosRef, updateObject);
        }
        mapElement.removeChild(playerElements[rmPlayerId]);
        delete playerElements[rmPlayerId];
    });
    
        function updatePlayer(playerID, newData){
            if (playerID in playerElements){
                if (playerID in players){
                    playersPositions[players[playerID].y][players[playerID].x] = 0;
                }
                playersPositions[newData.y][newData.x] = 1;
                playerElements[playerID].style.setProperty("transform", 
                `translate3d(${newData.x * 50}%, ${newData.y * 50}%, 0)`);
                playerElements[playerID].setAttribute("data-color", newData.color);
                playerElements[playerID].setAttribute("data-direction", newData.direction);
                playerElements[playerID].querySelector(".nameTag").innerHTML = newData.name;
                players[playerID] = newData;
            } 
        }
    

    //lasers 
    onChildAdded(lasersRef, (snapshot) => {
        const key = snapshot.key;
        const data = snapshot.val();
        const newElement = document.createElement('div');
        newElement.classList.add('laser');
        mapElement.appendChild(newElement);
        newElement.innerHTML = `<img src="./images/laserBeams.png">`;
        newElement.setAttribute('data-color', data.color);
        newElement.setAttribute('data-direction', data.direction);
        newElement.style.setProperty('transform', `translate(${100 * data.x}%, ${100 * data.y}%)`);
        newElement.classList.add('fadeOut');

        laserElements[key] = newElement; 
        newElement.addEventListener('animationend', () => {
            remove(ref(db, "lasers/" + key));
        })

        const myPlayer = players[myUid];
        if(myPlayer && myPlayer.x === data.x && myPlayer.y === data.y){
            remove(myPlayerRef);
            areKeysActive = false;
        }
    });

    onChildRemoved(lasersRef, (snapshot) => {
        const key = snapshot.key;
        mapElement.removeChild(laserElements[key]);
        delete(laserElements[key]);
    });

    function shootLaser(){
        if (myPlayerRef){
            const myPlayer = players[myUid];
            let x = myPlayer.x + myPlayer.facing[0];
            let y = myPlayer.y + myPlayer.facing[1];
            const color = myPlayer.color;
            let direction;
            if(myPlayer.facing[0] === 0){
                direction = "vertical";
            }
            else{
                direction = "horizontal"; 
            }
            for( let i = 0; i < 3; i++){
                if ( 0 <= x && x < mapSize[0] && 0 <= y && y < mapSize[1] && map[y][x] === 0){
                    const newLaserRef = push(lasersRef);
                    set(newLaserRef, {
                        x,
                        y,
                        color,
                        direction,
                    })
                }
                else{
                    break;
                }
                x += myPlayer.facing[0];
                y += myPlayer.facing[1];
            }
            switch(getComputedStyle(myArrowElement).getPropertyValue('animation-name')){
                case 'arrowFade1':
                    myArrowElement.style.setProperty('animation-name', 'arrowFade2');
                    break;
                case 'arrowFade2':
                    myArrowElement.style.setProperty('animation-name', 'arrowFade1');
            }
        }
    }

    function turn(direction){
        if (myPlayerRef){
            if (direction[0] === 0){
                if (direction[1] > 0){
                    update(myPlayerRef, {
                        direction: "down",
                        facing: [...direction]
                    });    
                }
                else{
                    update(myPlayerRef, {
                        direction: "up",
                        facing: [...direction]
                    });
                }
            } 
            else{
                if (direction[0] > 0){
                    update(myPlayerRef, {
                        direction: "right",
                        facing: [...direction]
                    });
                } 
                else{
                    update(myPlayerRef, {
                        direction: "left",
                        facing: [...direction]
                    });
                } 
            }
        }
    }

    function move(direction){
        if (myPlayerRef){
            const myPlayer = players[myUid];
            let newX = myPlayer.x + direction * myPlayer.facing[0];
            let newY = myPlayer.y + direction * myPlayer.facing[1];
            if (0 <= newY && newY < map.length && 
            0 <= newX && newX < map[0].length && 
            map[newY][newX] != 1 && playersPositions[newY][newX] != 1){
                if (direction[1] > 0){
                    update(myPlayerRef, {
                        x: newX,
                        y: newY,
                    });    
                }
                else{
                    update(myPlayerRef, {
                        x: newX,
                        y: newY,
                    });
                }
            } 
        }
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            myUid = user.uid;
            connected = true;
            myUserRef = ref(db, "users/" + `${myUid}`); 
            set(myUserRef , {
                timestamp: serverTimestamp(),
                name: `${myName}`
            });
            onDisconnect(myUserRef).remove();
            const tmpRef = ref(db, 'players/' + myUid)
            get(tmpRef, (snapshot) => {
                const data = snapshot.val(); 
                if (data !== null){
                    myPlayerRef = tmpRef;
                    myPlayerRef;
                    myName = data.name;
                    myColorCode = getColorCode(data.color);
                    myColorIndex = findIndex(availableColorCodes, myColorCode); 
                    areKeysActive = true;
                    myArrowElement = playerElements[myUid].querySelector('#arrow');
                    inGame = true;
                    nameInputElement.disabled = true;
                }
            });
        } 
        else {
            connected = false;
            console.log('disconnected');
        }
    });
    
    function spawnMyPlayer(uid){
        if (isColorCodesFree[myColorCode]){
            const newRef = ref(db, "players/" + uid);
            const data = playerData[myColorCode];
            const setObject = { ...data, ...{
                name: myName,
                score: 0,
            }};

            set(newRef, setObject).catch((e) => console.log(e));
    
            const updateObject = {};
            updateObject[myColorCode] = false;
            update(spawnPosRef, updateObject);
            return newRef;
        }
        return null;
    }
    
    signInAnonymously(auth)
    .then(() => {
        console.log("you have lgged in");
    })
    .catch((error) =>{
        let errorCode = error.code;
        let errorMessage = error.message;
        console.log(errorCode, errorMessage);
    })
    
}) ();

function findIndex(arr, val){
    for(let i = 0; i < arr.length; i++){
        if (arr[i] === val){
            return i;
        }
    }
    return null
}

function findKey(obj, val){
    for(key in obj){
        if (obj[key] === val){
            return key;
        }
    }
    return null
}

function getColorCOde(color){
    switch (color){
        case "pink":
            return "0x0";
        case "yellow":
            return "0x6";
        case "green":
            return "14x0";
        case "purple":
            return "14x6";
    }
}
