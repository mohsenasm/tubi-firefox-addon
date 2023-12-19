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
            console.log("tubi-firefox-addon: error2:", href, groups)
        }
    }
    if (text.includes("Unfortunately, bots use DuckDuckGo too")) {
        console.log("tubi-firefox-addon: DuckDuckGo rate limit for", url)
    } else {
        console.log("tubi-firefox-addon: error3:", url, text)
    }
    return undefined;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) };

function getRandomInt(max) { return Math.floor(Math.random() * max); }

async function getRanking(title, onlyUseCache) {
    let movieNameKey = getKey(title.movieName, title.movieYear);
    let value = await getInfo(movieNameKey);
    if (value !== undefined) {
        return value;
    } else if (onlyUseCache === false) {
        let movieId = await getMovieId(movieNameKey);
        if (movieId) {
            let url = "http://www.omdbapi.com/?i=" + String(movieId) + "&apikey=8f695bca";
            let data = await fetch(url);
            let json = await data.json();

            let imdbRating, imdbVotes;
            let foundImdbRating = false;
            if (json.Response) {
                foundImdbRating = true;
                imdbRating = json.imdbRating;
                imdbVotes = json.imdbVotes;
            }
            let movieData = { imdbRating, imdbVotes, movieId, foundImdbRating };

            await saveInfo(movieNameKey, movieData);
            return movieData;
        }
    }
}

function injectLoading(title) {
    removeExistingRakingFromElement(title.parentElement)
    const div = document.createElement("div");
    div.className = "web-rating tubi-firefox-addon";
    div.style.whiteSpace = "pre";

    div.style.backgroundColor = "gray";
    div.style.color = "white";
    div.style.fontStyle = "italic";

    div.innerHTML = "loading ...";
    title.titleElement.after(div);
}

function injectRanking(title, movieData) {
    if (movieData && movieData.foundImdbRating) {
        removeExistingRakingFromElement(title.parentElement)
        const div = document.createElement("div");
        div.className = "web-rating tubi-firefox-addon";
        div.style.whiteSpace = "pre";

        let r = parseFloat(movieData.imdbRating)
        if (isNaN(r)) {
            div.style.backgroundColor = "gray";
            div.style.color = "white";
        } else if (r < 4) {
            div.style.backgroundColor = "red";
            div.style.color = "black";
        } else if (r < 6) {
            div.style.backgroundColor = "orange";
            div.style.color = "black";
        } else {
            div.style.backgroundColor = "green";
            div.style.color = "white";
        }

        div.innerHTML = `${movieData.imdbRating} | ${movieData.imdbVotes} votes`;
        div.onclick = (e) => {
            e.preventDefault();
            window.open(`https://www.imdb.com/title/${movieData.movieId}/`);
        };
        title.titleElement.after(div);
    }
}

async function getAndInjectRanking(title, onlyUseCache = false) {
    let movieData = await getRanking(title, onlyUseCache);
    if (movieData) {
        injectRanking(title, movieData)
        return { success: true }
    } else {
        return { success: false, title }
    }
}


async function runTasks(titles) {
    // add loading
    for (let i = 0; i < titles.length; i++) {
        const title = titles[i];
        injectLoading(title);
    }

    // add cached ones
    let nonCachedTitle = [];
    for (let i = 0; i < titles.length; i++) {
        const title = titles[i];
        let result = await getAndInjectRanking(title, true);
        if (result.success === false) {
            nonCachedTitle.push(title);
        }
    }

    // fast retrieval
    let results = [];
    const BATCH_IN_PARALLEL = 5;
    for (let i = 0; i < nonCachedTitle.length;) {
        let promises = [];
        for (let j = 0; j < BATCH_IN_PARALLEL && i < nonCachedTitle.length; i++, j++) {
            let title = nonCachedTitle[i];
            promises.push(getAndInjectRanking(title));
        }
        let partialResults = await Promise.all(promises);
        results = results.concat(partialResults)
    }
    let failedTitles = [];
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.success === false) {
            let t = result.title;
            t.tryCount = 1;
            failedTitles.push(t);
        }
    }

    // one-by-one retrieval
    if (failedTitles.length > 0) {
        console.log("tubi-firefox-addon: one-by-one retrieval after 5s sleep");
        await sleep(5000);
    }
    while (failedTitles.length > 0) {
        const title = failedTitles.pop();
        await sleep((getRandomInt(1000) + 500) * title.tryCount);
        let result = await getAndInjectRanking(title);
        if (result.success === false) {
            title.tryCount += 1;
            // try again later
            if (title.tryCount <= 3) {
                failedTitles.push(title);
            } else {
                console.log("tubi-firefox-addon: could not get", title.movieName);
                removeExistingRakingFromElement(title.parentElement);
            }
        }
    }

    console.log("tubi-firefox-addon: done");
}

function removeExistingRakingFromElement(parent) {
    let oldRankings = parent.querySelectorAll(".tubi-firefox-addon");
    for (let i = 0; i < oldRankings.length; i++) {
        const element = oldRankings[i];
        element.remove();
    }
}

async function checkDataVersion() {
    const CURRENT_VERSION = 1;
    let value = await getInfo("data-version");
    if ((value === undefined) || value < CURRENT_VERSION) {
        browser.storage.local.clear();
        await saveInfo("data-version", CURRENT_VERSION);
    }
}

async function main() {
    await checkDataVersion();

    let titles = [];
    let parentElements = document.getElementsByClassName('web-content-tile__content-digest');
    for (let i = 0; i < parentElements.length; ++i) {
        let parentElement = parentElements[i];
        try {
            let titleElement = parentElement.getElementsByClassName("web-content-tile__title")[0];
            let movieName = titleElement.innerHTML;
            let movieYear = parentElement.getElementsByClassName("web-content-tile__year")[0].innerHTML;
            titles.push({ movieName, movieYear, titleElement, parentElement })
        } catch (error) {
            console.error("error in parsing element", error, parentElement)
        }
    }
    runTasks(titles);
}

// browser.storage.local.clear();
main()