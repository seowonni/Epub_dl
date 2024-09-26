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

function createEPUBContent(novelText) {
    const epubHeader = `<?xml version="1.0" encoding="utf-8"?>
    <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
        <metadata>
            <title>${novelText.title}</title>
            <author>Your Name</author>
            <language>en</language>
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

    for (let i = episodeLinks.length - startEpisode; i < episodeLinks.length; i++) {
        const episodeUrl = episodeLinks[i];
        const episodeContent = await fetchNovelContent(episodeUrl);
        if (episodeContent) {
            novelContent.push(`<section><h2>Episode ${i + 1}</h2>${episodeContent}</section>`);
        }
    }

    const epubData = createEPUBContent({
        title: title,
        content: novelContent.join('\n')
    });

    const zip = new JSZip();
    zip.file('content.opf', epubData.header);
    zip.file('cover.xhtml', epubData.cover);
    
    // Add your sections here, consider adding more files like images, etc.
    zip.file('toc.ncx', '<?xml version="1.0" encoding="UTF-8"?><ncx></ncx>'); // Add proper TOC as needed

    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title}.epub`;
    a.click();
}

async function runCrawler() {
    const title = extractTitle();
    const allEpisodeLinks = extractEpisodeLinks();
    const startEpisode = prompt(`다운로드를 시작할 회차 번호를 입력하세요 (1 부터 ${allEpisodeLinks.length}):`, '1');

    if (startEpisode) {
        await downloadNovel(title, allEpisodeLinks, parseInt(startEpisode));
    }
}

runCrawler();
