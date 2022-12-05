const fs = require('fs');
const dayjs = require('dayjs');
const tz = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');
const axios = require('axios');
const languages = require('./languages');
const parser = require('./github-trending-html-parser');

dayjs.extend(tz);
dayjs.extend(utc);

const MAX_RETRY = 5;

const sinces = ['daily', 'weekly', 'monthly']

sinces.forEach((since) => {
  fs.mkdirSync(`data/repositories/${since}/`, { recursive: true });
  fs.mkdirSync(`data/developers/${since}/`, { recursive: true });
})

fs.writeFileSync('data/languages.json', JSON.stringify({
  updateTime: dayjs().tz('PRC').format('YYYY-MM-DD hh:mm:ss'),
  data: languages
}));

async function sleep (time) {
  await new Promise((resolve) => setTimeout(resolve, time))
}

async function fetchGithubTrendingHtml(type, language, since, retry = 0) {
  const url = `https://github.com/trending${type === 'developers' ? '/developers' : ''}/${language}?since=${since}`
  if (retry <= MAX_RETRY) {
    try {
      const { data  } = await axios.get(url, {
        timeout: 10000
      });
      return data;
    } catch (error) {
      const { status } = error.response || {};
      if (status === 429) {
        const wait = 10 + Math.pow(1.7, retry + 1) + Math.pow(1.5, retry + 1) * Math.random()
        console.log(`> status = 429 wait ${wait.toFixed(2)}s and retry: ${url} `);
        await sleep(wait * 1000);
        return fetchGithubTrendingHtml(type, language, since, retry + 1)
      }
      throw error
    }
  } else {
    throw new Error(`Max retries.(${url})`)
  }
}

;(async () => {
  for (const { urlParam: language } of languages) {
    await Promise.all([
      ...sinces.map(async (since) => {
        try {
          console.log(`\n> gen repositories ${since}/${language} ...`);
          const repositories = parser.repositories(await fetchGithubTrendingHtml('repositories', language, since));
          fs.writeFileSync(`data/repositories/${since}/${language}.json`, JSON.stringify({
            updateTime: dayjs().tz('PRC').format('YYYY-MM-DD hh:mm:ss'),
            data: repositories
          }))
          console.log(`√ gen repositories ${since}/${language} ok!`);
        } catch (e) {
          console.log(`x gen repositories ${since}/${language} failed!`, e.message);
        }
      }),
      ...sinces.map(async (since) => {
        try {
          console.log(`\n> gen developers ${since}/${language} ...`);
          const developers = parser.developers(await fetchGithubTrendingHtml('developers', language, since));
          fs.writeFileSync(`data/developers/${since}/${language}.json`, JSON.stringify({
            updateTime: dayjs().tz('PRC').format('YYYY-MM-DD hh:mm:ss'),
            data: developers
          }))
          console.log(`√ gen developers ${since}/${language} ok!`);
        } catch (e) {
          console.log(`x gen developers ${since}/${language} failed!`, e.message);
        }
      }),
      sleep(1500)
    ])
  }
})()
