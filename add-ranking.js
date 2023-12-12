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

async function getMovieId(movieNameKey, movieYear) {
    // https://html.duckduckgo.com/html/?q=site:imdb.com+la+finest
    // <a rel="nofollow" class="result__a" href="https://www.imdb.com/title/tt7555294/">L.A.&#x27;s Finest (TV Series 2019-2020) - IMDb</a>
    // <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.imdb.com%2Ftitle%2Ftt7555294%2Fepisodes%2F%3Fyear%3D2019&amp;rut=e59eeb5a916d3deb5b6a93a48563cfaac11000afd26c4912db5aff55ad120b9f">L.A.&#x27;s Finest (TV Series 2019-2020) - Episode list - IMDb</a>

    let url = "https://html.duckduckgo.com/html/?q=site:imdb.com+" + movieNameKey + "+" + String(movieYear);
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
    let movieNameKey = getKey(movieName);
    let value = await getInfo(movieNameKey);
    if (value !== undefined) {
        return value;
    } else {
        let movieId = await getMovieId(movieNameKey, movieYear);
        let url = "http://www.omdbapi.com/?i=" + String(movieId) + "&apikey=8f695bca";
        // let url = "http://www.omdbapi.com/?t=" + movieNameKey + "&y=" + movieYear + "&apikey=8f695bca";
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
            await saveInfo(movieNameKey, imdbRating);
            return imdbRating;
        }
    }
}

// document.body.textContent = "";
// let header = document.createElement("h1");
// header.textContent = "This page has been eaten";
// document.body.appendChild(header);

console.log("start adding ranking :D")
// browser.storage.local.clear()

var parentElements = document.getElementsByClassName('web-content-tile__content-digest');
for (let i = 0; i < parentElements.length; ++i) {
    let parentElement = parentElements[i];
    try {
        let movieName = parentElement.getElementsByClassName("web-content-tile__title")[0].innerHTML;
        let movieYear = parentElement.getElementsByClassName("web-content-tile__year")[0].innerHTML;
        getRanking(movieName, movieYear).then((ranking) => { console.log("ranking", movieName, ranking) })
    } catch (error) {
        console.error("error in parsing element", error, parentElement)
    }
}

{/* <div class="web-content-tile__content-digest">
  <a href="/series/300010104/la-s-finest" class="web-content-tile__title"
    >LA's Finest</a
  >
  <div class="web-content-tile__year-duration-rating">
    <div class="web-content-tile__year">2019</div>
    <div class="web-content-tile__rating">
      <div class="web-rating"><div class="web-rating__content">TV-14</div></div>
    </div>
  </div>
  <div class="web-content-tile__tags-row">
    <div class="web-content-tile__tags">
      Action&nbsp;·&nbsp;Comedy&nbsp;·&nbsp;Crime
    </div>
  </div>
</div> */}

// http://www.omdbapi.com/?s=Medusa%27s+Venom:+The+Beast+is+Back&apikey=8f695bca
