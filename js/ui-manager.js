import { WORKS_DATA } from './data.js';
import { setPerformanceMode } from './main.js';

const UIManager = {
    init() { this.bindEvents(); },
    bindEvents() {
        document.getElementById('intro-kor-btn')?.addEventListener('click', () => this.toggleIntro('kor'));
        document.getElementById('intro-eng-btn')?.addEventListener('click', () => this.toggleIntro('eng'));

        // [보존] 메인 페이지에 통합된 이메일 복사 기능
        const emailBtn = document.getElementById('email-text');
        if (emailBtn) {
            emailBtn.onclick = () => {
                navigator.clipboard.writeText("helloteamcjs@gmail.com");
                emailBtn.innerText = "copied !"; emailBtn.classList.add('selected');
                setTimeout(() => { emailBtn.innerText = "helloteamcjs@gmail.com"; emailBtn.classList.remove('selected'); }, 1500);
            };
        }

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => this.closeModal(e.target.dataset.modal));
        });
        window.onclick = (e) => { if (e.target.classList.contains('modal')) this.closeModal(e.target.id); };
    },
    toggleIntro(lang) {
        const el = document.getElementById(lang === 'kor' ? 'intro-kor' : 'intro-eng'); el?.classList.toggle('active');
    },
    openModal(name) {
        const el = document.getElementById(`${name}-modal`);
        if (el) {
            setPerformanceMode(true); this.renderContent(name);
            el.classList.add('active'); document.querySelector('canvas')?.classList.add('modal-active');
            document.body.style.cursor = 'default';
            if (name === 'video') setTimeout(() => this.initVideoObserver(), 100);
        }
    },
    closeModal(id) {
        const el = document.getElementById(id.includes('modal') ? id : `${id}-modal`);
        if (el) {
            setPerformanceMode(false); el.classList.remove('active');
            document.querySelector('canvas')?.classList.remove('modal-active');
            const renderContainer = el.querySelector('.modal-content') || el.querySelector('.video-content') || el.querySelector('.web-content') || el.querySelector('.construct-content') || el.querySelector('.show-content');
            if (renderContainer) renderContainer.innerHTML = '';
        }
    },
    renderContent(key) {
        const container = document.getElementById(`${key}-render`);
        if (!container) return;
        const footerHtml = `<div class="modal-footer">© 2026 chungjinsung</div>`;
        let contentHtml = '';

        if (key === 'profile') {
            const d = WORKS_DATA.profile;
            contentHtml = `<div class="column column-list"><span class="blue">작가, 디자이너, 연구자 이력\npainter, designer, researcher cv</span>\n\n${d.cv}</div><div class="column column-list"><span class="blue">전시경력\nexhibition</span>\n\n${d.exhibition}</div><div class="column column-intro">${d.statement}</div>`;
        } else {
            WORKS_DATA[key].forEach(item => {
                if (key === 'video') {
                    let params = `?enablejsapi=1`;
                    if (item.start !== undefined) params += `&start=${item.start}`; if (item.end !== undefined) params += `&end=${item.end}`;

                    const media = item.type === 'auto'
                        ? `<iframe class="auto-video" src="https://www.youtube.com/embed/${item.id}${params}" allowfullscreen></iframe>`
                        : `<a href="https://youtu.be/${item.id}${item.start ? '?t=' + item.start : ''}" target="_blank"><img src="https://img.youtube.com/vi/${item.id}/maxresdefault.jpg" loading="lazy"></a>`;

                    // [보존] 비디오 캡션 렌더링 로직
                    const caption = item.caption ? `<p class="work-caption">${item.caption}</p>` : '';
                    contentHtml += `<div class="video-item"><div class="video-wrapper">${media}</div>${caption}</div>`;
                } else if (key === 'web' || key === 'construct' || key === 'show') {
                    const caption = item.caption ? `<p class="work-caption">${item.caption}</p>` : '';
                    contentHtml += `<div class="work-item" style="max-width: 800px;">${item.url ? `<a href="${item.url}" target="_blank">` : ''}<img src="${item.src}" class="work-img" loading="lazy">${item.url ? `</a>` : ''}${caption}</div>`;
                } else {
                    let span = 2;
                    if (item.size === 1.5) span = 3; else if (item.size === 2) span = 4; else if (item.size === 3) span = 6;
                    const caption = item.caption ? `<p class="work-caption">${item.caption}</p>` : '';
                    contentHtml += `<div class="work-item w${span}"><div class="img-container"><img src="${item.src}" class="work-img" loading="lazy"></div>${caption}</div>${item.break ? `<div class="grid-breaker"></div>` : ''}`;
                }
            });
        }
        container.innerHTML = contentHtml + footerHtml;
    },
    initVideoObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const f = entry.target;
                if (entry.isIntersecting && f.tagName === 'IFRAME') {
                    f.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
                    f.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                } else if (f.tagName === 'IFRAME') f.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
            });
        }, { root: document.getElementById('video-scroll-container'), threshold: 0.6 });
        document.querySelectorAll('.auto-video').forEach(v => observer.observe(v));
    }
};

window.openModal = (name) => UIManager.openModal(name);
window.closeModal = (id) => UIManager.closeModal(id);
UIManager.init();