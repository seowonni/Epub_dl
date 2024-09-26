<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>

async function fetchNovelContent(url) {
    const response = await fetch(url);

    if (!response.ok) {
        console.error(`Failed to fetch content from ${url}. Status: ${response.status}`);
        return null;
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const content = doc.querySelector('#novel_content');

    if (!content) {
        console.error(`Failed to find '#novel_content' on the page: ${url}`);
        return null;
    }

    return cleanText(content.innerHTML);
}

function unescapeHTML(text) {
    const entities = {
        '&lt;': '<', '&gt;': '>', '&amp;': '&',
        '&quot;': '"', '&apos;': "'", '&#039;': "'",
        '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—',
        '&lsquo;': '‘', '&rsquo;': '’', '&ldquo;': '“', '&rdquo;': '”'
    };

    return text.replace(/&[a-z]+;/g, (entity) => entities[entity] || entity);
}

function cleanText(text) {
    text = text.replace(/<div>/g, '');
    text = text.replace(/<\/div>/g, '');
    text = text.replace(/<p>/g, '\n');
    text = text.replace(/<\/p>/g, '\n');
    text = text.replace(/<br\s*[/]?>/g, '\n');
    text = text.replace(/<[^>]*>/g, '');
    text = text.replace(/ {2,}/g, ' ');
    text = text.replace(/\n{2,}/g, '\n\n');
    text = unescapeHTML(text);

    return text;
}

async function downloadNovelAsEPUB(title, episodeLinks, startEpisode) {
    const zip = new JSZip();
    const novelFolder = zip.folder('EPUB');
    const contentFolder = novelFolder.folder('Text');
    
    const mimetype = 'application/epub+zip';
    zip.file('mimetype', mimetype);

    const containerXML = `<?xml version="1.0" encoding="UTF-8" ?>
    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
            <rootfile full-path="EPUB/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
    </container>`;
    zip.folder('META-INF').file('container.xml', containerXML);

    let novelText = '';

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    const startTime = new Date();
    const startingIndex = episodeLinks.length - startEpisode;

    let spineItems = '';
    let manifestItems = '';

    for (let i = startingIndex; i >= 0; i--) {
        const episodeUrl = episodeLinks[i];

        if (!episodeUrl.startsWith('https://booktoki')) {
            console.log(`Skipping invalid episode link: ${episodeUrl}`);
            continue;
        }

        console.log(`Downloading: ${title} - Episode ${startingIndex - i + 1}/${startingIndex + 1}`);

        let episodeContent = await fetchNovelContent(episodeUrl);

        if (!episodeContent) {
            console.error(`Failed to fetch content for episode: ${episodeUrl}`);
            continue;
        }

        const fileName = `chapter${startingIndex - i + 1}.xhtml`;
        const xhtmlContent = `<?xml version="1.0" encoding="utf-8"?>
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head><title>${title} - Chapter ${startingIndex - i + 1}</title></head>
        <body><h1>Chapter ${startingIndex - i + 1}</h1><p>${episodeContent}</p></body></html>`;
        contentFolder.file(fileName, xhtmlContent);

        manifestItems += `<item id="chapter${startingIndex - i + 1}" href="Text/${fileName}" media-type="application/xhtml+xml"/>`;
        spineItems += `<itemref idref="chapter${startingIndex - i + 1}"/>`;

        await delay(Math.random() * 500 + 1000);
    }

    const contentOpf = `<?xml version="1.0" encoding="UTF-8" ?>
    <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:title>${title}</dc:title>
            <dc:language>ko</dc:language>
            <meta property="dcterms:modified">${new Date().toISOString().slice(0, 10)}</meta>
        </metadata>
        <manifest>
            ${manifestItems}
        </manifest>
        <spine>
            ${spineItems}
        </spine>
    </package>`;

    novelFolder.file('content.opf', contentOpf);

    const blob = await zip.generateAsync({ type: 'blob' });
    const fileName = `${title}(${startEpisode}~${episodeLinks.length}).epub`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
}

async function runCrawler() {
    const novelPageRule = 'https://booktoki';
    let currentUrl = window.location.href;

    const urlParts = currentUrl.split('?')[0];
    currentUrl = urlParts;

    if (!currentUrl.startsWith(novelPageRule)) {
        console.log('This script should be run on the novel episode list page.');
        return;
    }

    const title = extractTitle();

    if (!title) {
        console.log('Failed to extract the novel title.');
        return;
    }

    const totalPages = prompt(`소설 목록의 페이지 수를 입력하세요.`, '1');

    if (!totalPages || isNaN(totalPages)) {
        console.log('Invalid page number or user canceled the input.');
        return;
    }

    const totalPagesNumber = parseInt(totalPages, 10);
    const allEpisodeLinks = [];

    for (let page = 1; page <= totalPagesNumber; page++) {
        const nextPageUrl = `${currentUrl}?spage=${page}`;
        const nextPageDoc = await fetchPage(nextPageUrl);
        if (nextPageDoc) {
            const nextPageLinks = Array.from(nextPageDoc.querySelectorAll('.item-subject')).map(link => link.getAttribute('href'));
            allEpisodeLinks.push(...nextPageLinks);
        }
    }

    const startEpisode = prompt(`다운로드를 시작할 회차 번호를 입력하세요 (1 부터 ${allEpisodeLinks.length}):`, '1');

    if (!startEpisode || isNaN(startEpisode)) {
        console.log('Invalid episode number or user canceled the input.');
        return;
    }

    const startEpisodeNumber = parseInt(startEpisode, 10);

    if (startEpisodeNumber < 1 || startEpisodeNumber > allEpisodeLinks.length) {
        console.log('Invalid episode number.');
        return;
    }

    downloadNovelAsEPUB(title, allEpisodeLinks, startEpisodeNumber);
}

runCrawler();

