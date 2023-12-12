// about:debugging

// http://www.omdbapi.com/?t=The+Devil+Is+a+Part-Timer!&y=2013&apikey=8f695bca

// web-content-tile__content-digest
// web-content-tile__title
// web-content-tile__year

function getKey(movieName) {
    return movieName.replace(/\s+/g, '+');
}

async function saveInfo(key, value) {
    let d = {};
    d[key] = value;
    await browser.storage.local.set(d);
}

async function getInfo(key) {
    let res = await browser.storage.local.get(key);
    return res[key];
}

async function getRanking(movieName, movieYear) {
    let movieNameKey = getKey(movieName);
    let value = await getInfo(movieNameKey);
    if (value !== undefined) {
        return value;
    } else {
        let data = await fetch("http://www.omdbapi.com/?t=" + movieNameKey + "&y=" + movieYear + "&apikey=8f695bca");
        let json = data.json();
        let imdbRating;
        if (json.Response) {
            imdbRating = json.imdbRating;
        } else {
            imdbRating = "not found";
        }
        await saveInfo(movieNameKey, imdbRating);
        return imdbRating;
    }
}

// document.body.textContent = "";

// let header = document.createElement("h1");
// header.textContent = "This page has been eaten";
// document.body.appendChild(header);

console.log("start :D")
// getRanking("test someting", 2018).then()