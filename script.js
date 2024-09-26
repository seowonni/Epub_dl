
import JSZip from 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
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

function cleanText(text) {
    return text; // Implement cleaning logic as needed
}

function createModal() {
    const modal = document.createElement('div');
    modal.id = 'downloadProgressModal';
    modal.style.display = 'block';
    modal.style.position = 'fixed';
    modal.style.zIndex = '1';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.overflow = 'auto';
    modal.style.backgroundColor = 'rgba(0,0,0,0.4)';

    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = '#fefefe';
    modalContent.style.position = 'relative';
    modalContent.style.margin = '15% auto 0';
    modalContent.style.padding = '20px';
    modalContent.style.border = '1px solid #888';
    modalContent.style.width = '50%';
    modalContent.style.textAlign = 'center';

    modal.appendChild(modalContent);

    return {modal, modalContent};
}

function createEPUBFiles(title, chapters) {
    const manifest = chapters.map((_, index) => `<item id="chapter${index + 1}" href="chapter${index + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('\n');
    const spine = chapters.map((_, index) => `<itemref idref="chapter${index + 1}"/>`).join('\n');

    const contentOPF = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
    <metadata>
        <title>${title}</title>
        <author>Your Name</author>
        <language>en</language>
    </metadata>
    <manifest>
        ${manifest}
        <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    </manifest>
    <spine>
        ${spine}
    </spine>
</package>`;

    const tocNCX = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
    <head>
        <meta name="dtb:uid" content="bookid"/>
        <meta name="dtb:depth" content="1"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
    </head>
    <body>
        <navMap>
            ${chapters.map((_, index) => `<navPoint id="navPoint-${index + 1}" playOrder="${index + 1}"><navLabel><text>Chapter ${index + 1}</text></navLabel><content src="chapter${index + 1}.xhtml"/></navPoint>`).join('\n')}
        </navMap>
    </body>
</ncx>`;

    const chapterFiles = chapters.map((content, index) => {
        return `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter ${index + 1}</title></head><body><h1>Chapter ${index + 1}</h1>${content}</body></html>`;
    });

    return {
        contentOPF,
        tocNCX,
        chapterFiles
    };
}

function createEPUBContent(novelText) {
    const epubHeader = `<?xml version="1.0" encoding="utf-8"?>
    <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
        <metadata>
            <title>${novelText.title}</title>
            <author></author>
            <language>kor</language>
        </metadata>
        <manifest>
            <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
            <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
            ${novelText.content}
        </spine>
    </package>`;

    const coverHTML = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Cover</title></head><body><h1>${novelText.title}</h1></body></html>`;
    
    return {
        header: epubHeader,
        cover: coverHTML,
    };
}

async function downloadNovel(title, episodeLinks, startEpisode) {
    let novelContent = [];
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const {modal, modalContent} = createModal();
    document.body.appendChild(modal);

    const progressBar = document.createElement('div');
    progressBar.style.width = '0%';
    progressBar.style.height = '10px';
    progressBar.style.backgroundColor = '#008CBA';
    progressBar.style.marginTop = '10px';
    progressBar.style.borderRadius = '3px';
    modalContent.appendChild(progressBar);

    const progressLabel = document.createElement('div');
    progressLabel.style.marginTop = '5px';
    modalContent.appendChild(progressLabel);

    const startTime = new Date();
    const startingIndex = episodeLinks.length - startEpisode;
    for (let i = startingIndex; i >= 0; i--){
        const episodeUrl = episodeLinks[i];
        if (!episodeUrl.startsWith('https://booktoki')) {
            console.log(`Skipping invalid episode link: ${episodeUrl}`);
            continue;
        }
        const logText = `Downloading: ${title} - Episode ${startingIndex - i + 1}/${startingIndex + 1}`;
        console.log(logText);
        const episodeContent = await fetchNovelContent(episodeUrl);
        if (!episodeContent) {
            console.error(`Failed to fetch content for episode: ${episodeUrl}`);

            // Ask the user to solve the CAPTCHA
            const userConfirmed = await new Promise(resolve => {
                const confirmResult = confirm(`이 페이지에 캡챠가 발견되었습니다.
${episodeUrl}.
새 탭에서 해당 페이지에 접속하여 캡챠를 풀고, 확인을 눌러주세요.`);
                resolve(confirmResult);
            });

            if (userConfirmed) {
                // Retry fetching the content
                episodeContent = await fetchNovelContent(episodeUrl);
                if (!episodeContent) {
                    console.error(`Failed to fetch content for episode after CAPTCHA: ${episodeUrl}`);
                    continue;  // Skip this episode if it still fails
                }
            } else {
                console.log("User cancelled. Skipping this episode.");
                continue;
            }
        }//!episode context if 문
        if (episodeContent) {
            novelContent.push(episodeContent);
        }
        const progress = ((startingIndex - i + 1) / (startingIndex + 1)) * 100;
        progressBar.style.width = `${progress}%`;

        const elapsedTime = new Date() - startTime;
        const estimatedTotalTime = (elapsedTime / progress) * 100;
        const remainingTime = estimatedTotalTime - elapsedTime;
        const remainingMinutes = Math.floor(remainingTime / (1000 * 60));
        const remainingSeconds = Math.floor((remainingTime % (1000 * 60)) / 1000);

        progressLabel.textContent = `다운로드중... ${progress.toFixed(2)}%  -  남은 시간: ${remainingMinutes}분 ${remainingSeconds}초`;

        await delay(Math.random() * 500 + 1000);
    }
    document.body.removeChild(modal);
    
    //const epubData = createEPUBContent({title: title,content: novelContent.join('\n')});
    //const zip = new JSZip();
    //zip.file('content.opf', epubData.header);
    //zip.file('cover.xhtml', epubData.cover);
    // Add your sections here, consider adding more files like images, etc.
    //zip.file('toc.ncx', '<?xml version="1.0" encoding="UTF-8"?><ncx></ncx>'); // Add proper TOC as needed
    //const blob = await zip.generateAsync({ type: 'blob' });
    //const a = document.createElement('a');
    //a.href = URL.createObjectURL(blob);
    //a.download = `${title}.epub`;
    //a.click();
    const { contentOPF, tocNCX, chapterFiles } = createEPUBFiles(title, chapters);

    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip'); // Required for EPUB format
    zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
    <rootfiles>
        <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`);

    zip.file('content.opf', contentOPF);
    zip.file('toc.ncx', tocNCX);

    chapterFiles.forEach((fileContent, index) => {
        zip.file(`chapter${index + 1}.xhtml`, fileContent);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title}.epub`;
    a.click();
}
function extractTitle() {
    const titleElement = document.evaluate('//*[@id="content_wrapper"]/div[1]/span', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    return titleElement ? titleElement.textContent.trim() : null;
}
function extractEpisodeLinks() {
    const episodeLinks = [];
    const links = document.querySelectorAll('.item-subject');

    links.forEach(link => {
        const episodeLink = link.getAttribute('href');
        episodeLinks.push(episodeLink);
    });

    return episodeLinks;
}

async function fetchPage(url) {
    const response = await fetch(url);
    if (!response.ok) {
        console.error(`Failed to fetch page: ${url}. Status: ${response.status}`);
        return null;
    }
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc;
}


async function runCrawler() {
    const novelPageRule = 'https://booktoki';
    let currentUrl = window.location.href;

    // Clean URL
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

    const totalPages = prompt(`소설 목록의 페이지 수를 입력하세요.
(1000화가 넘지 않는 경우 1, 1000화 이상부터 2~)`, '1');

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
        console.log('Invalid episode number. Please enter a number between 1 and the total number of episodes.');
        return;
    }

    console.log(`Task Appended: Preparing to download ${title} starting from episode ${startEpisodeNumber}`);

    downloadNovel(title, allEpisodeLinks, startEpisodeNumber);
}

runCrawler();
