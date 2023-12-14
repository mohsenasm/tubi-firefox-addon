function getKey(movieName, movieYear) {
    return String(movieName).replace(/\s+/g, '+') + "+" + String(movieYear);
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

async function getMovieId(movieNameKey) {
    // https://html.duckduckgo.com/html/?q=site:imdb.com+la+finest
    // <a rel="nofollow" class="result__a" href="https://www.imdb.com/title/tt7555294/">L.A.&#x27;s Finest (TV Series 2019-2020) - IMDb</a>
    // <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.imdb.com%2Ftitle%2Ftt7555294%2Fepisodes%2F%3Fyear%3D2019&amp;rut=e59eeb5a916d3deb5b6a93a48563cfaac11000afd26c4912db5aff55ad120b9f">L.A.&#x27;s Finest (TV Series 2019-2020) - Episode list - IMDb</a>

    let url = "https://html.duckduckgo.com/html/?q=site:imdb.com+" + movieNameKey;
    let data = await fetch(url);
    let text = await data.text();
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(text, 'text/html');
    const results = htmlDoc.getElementsByClassName("result__a");
    for (let i = 0; i < results.length; i++) {
        const a = results[i];
        const href = a.href;
        // const groups = href.match(/imdb\.com\/title\/([a-z0-9]+)/i);
        const groups = href.match(/imdb\.com\/title\/([a-z0-9]+)|imdb\.com%2Ftitle%2F([a-z0-9]+)/i);
        if (groups && (groups.length > 1)) {
            if (groups[1])
                return groups[1];
            if (groups[2])
                return groups[2];
        } else {
            console.log("e2", href, groups)
        }
    }
    console.log("e3", url, text)
    return undefined;
}

async function getRanking(movieName, movieYear) {
    let movieNameKey = getKey(movieName, movieYear);
    let value = await getInfo(movieNameKey);
    if (value !== undefined) {
        return value;
    } else {
        let movieId = await getMovieId(movieNameKey);
        let url = "http://www.omdbapi.com/?i=" + String(movieId) + "&apikey=8f695bca";
        console.log(url)
        if (movieId) {
            let data = await fetch(url);
            let json = await data.json();
            let imdbRating;
            if (json.Response) {
                imdbRating = json.imdbRating;
            } else {
                imdbRating = "not found";
            }
            let movieData = { imdbRating, movieId };
            await saveInfo(movieNameKey, movieData);
            return movieData;
        }
    }
}

function injectRanking(parentElement, titleElement, movieData) {
    const div = document.createElement("div");
    div.className = "web-rating tubi-add-ranking";
    div.style.whiteSpace = "pre";

    let r = parseFloat(movieData.imdbRating)
    if (r < 4) {
        div.style.backgroundColor = "red";
        div.style.color = "black";
    } else if (r < 6) {
        div.style.backgroundColor = "orange";
        div.style.color = "black";
    } else {
        div.style.backgroundColor = "green";
    }

    div.innerHTML = `${movieData.imdbRating} | <a href="https://www.imdb.com/title/${movieData.movieId}/">${movieData.movieId}</a>`;
    titleElement.after(div);
}

// console.log("start adding ranking :D")
// browser.storage.local.clear()

// note that we can not use 'let', beacuse of redeclaring of this var, when a user click twice
var oldRankings = document.querySelectorAll(".tubi-add-ranking");
for (let i = 0; i < oldRankings.length; i++) {
    const element = oldRankings[i];
    element.remove();
}

var parentElements = document.getElementsByClassName('web-content-tile__content-digest');
for (let i = 0; i < parentElements.length; ++i) {
    let parentElement = parentElements[i];
    try {
        let titleElement = parentElement.getElementsByClassName("web-content-tile__title")[0];
        let movieName = titleElement.innerHTML;
        let movieYear = parentElement.getElementsByClassName("web-content-tile__year")[0].innerHTML;
        getRanking(movieName, movieYear).then((movieData) => { injectRanking(parentElement, titleElement, movieData) })
    } catch (error) {
        console.error("error in parsing element", error, parentElement)
    }
}
