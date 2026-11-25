# Renders design-preview.html in headless Chrome, inlines style.css with the right breakpoint, writes 4 self-contained HTML files.
import re, subprocess, sys, pathlib
WEB = pathlib.Path('/Users/ashrafulasif/Gym/web')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
OUT = pathlib.Path(__file__).parent

def dump(hash_, w):
    r = subprocess.run([CHROME, '--headless=new', '--disable-gpu', f'--window-size={w},900', '--virtual-time-budget=6000',
                        '--dump-dom', f'http://localhost:3000/design-preview{hash_}'], capture_output=True, text=True, timeout=90)
    return r.stdout

def blocks(css, header_pat):
    """yield (start, end) of @media blocks whose header matches"""
    for m in re.finditer(r'@media[^{]*\{', css):
        if not re.search(header_pat, m.group(0)): continue
        depth, i = 1, m.end()
        while depth:
            depth += {'{': 1, '}': -1}.get(css[i], 0); i += 1
        yield m.start(), m.end(), i

def css_for(width_kind):
    css = (WEB / 'style.css').read_text()
    # drop print + reduced-motion blocks
    for pat in (r'print', r'prefers-reduced-motion'):
        for s, _, e in sorted(blocks(css, pat), reverse=True): css = css[:s] + css[e:]
    # desktop blocks: unwrap for desktop, drop for mobile
    for s, a, e in sorted(blocks(css, r'min-width:\s*900px'), reverse=True):
        inner = css[a:e - 1]
        css = css[:s] + (inner if width_kind == 'desktop' else '') + css[e:]
    css = re.sub(r'animation(-delay)?:[^;]*;', '', css)
    css = re.sub(r'transition:[^;]*;', '', css)
    return css

def drop_blocks(html, opener):
    while opener in html:
        i = html.index(opener); depth = 0; j = i
        for m in re.finditer(r'<div\b|</div>', html[i:]):
            depth += 1 if m.group(0) == '<div' else -1
            if depth == 0: j = i + m.end(); break
        html = html[:i] + html[j:]
    return html

ICONS = {
 'today': '<path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-5h4v5"/>',
 'members': '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2"/><circle cx="17.2" cy="9" r="2.4"/><path d="M16.4 14.6c2.9 0 4.6 1.7 4.6 4.4"/>',
 'add': '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
 'plans': '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM8.5 12h7M8.5 16h4.5"/>',
 'settings': '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
 'search': '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
}
def inline_icons(html):
    def sub(m):
        name = m.group(2)
        return f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"{m.group(1)}>{ICONS[name]}</svg>'
    return re.sub(r'<svg([^>]*)><use href="#i-(\w+)"></use></svg>', sub, html)

def build(name, hash_, kind, w):
    dom = dump(hash_, w)
    css = css_for(kind)
    extra = f"html,body{{width:{w}px;margin:0}} .shell{{min-height:0}} .rail{{height:auto;position:static}}"
    if kind == 'mobile': extra += " .rail{position:static;box-shadow:none;margin-top:16px} main{padding-bottom:16px}"
    dom = re.sub(r'<link rel="stylesheet" href="style.css">', f'<style>{css}\n{extra}</style>', dom)
    dom = re.sub(r'<script.*?</script>', '', dom, flags=re.S)
    dom = dom.replace(' hidden=""', ' hidden')
    # The converter ignores [hidden]: remove hidden views and the sprite outright, inline the icons it referenced.
    dom = re.sub(r'<div class="view"[^>]*\shidden[^>]*>', '<div class="view" data-drop>', dom)
    dom = drop_blocks(dom, '<div class="view" data-drop>')
    dom = inline_icons(dom)
    dom = re.sub(r'<svg[^>]*style="display:\s*none[^"]*"[^>]*>.*?</svg>', '', dom, count=1, flags=re.S)
    (OUT / f'{name}.html').write_text(dom)
    print(name, len(dom))

build('today-mobile', '', 'mobile', 390)
build('today-desktop', '', 'desktop', 1280)
build('members-mobile', '#members', 'mobile', 390)
build('members-desktop', '#members', 'desktop', 1280)
