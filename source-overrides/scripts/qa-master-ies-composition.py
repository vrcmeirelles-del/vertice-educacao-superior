"""Local fixture only: exercise the real head scrubber and Master bootstrap together."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = os.environ.get('MASTER_FIXTURE_ORIGIN', 'http://127.0.0.1:4178')
out = Path(os.environ.get('MASTER_COMPOSITION_OUTPUT', '/tmp/master-ies-browser.json'))
uid = '11111111-1111-4111-8111-111111111111'
master = f'master_invitation={uid}&master_token=' + 'a' * 43
ies = f'ies_invitation={uid}&ies_token=' + 'b' * 64
cases = [('Master alone', '', master, 1, True), ('IES alone', '', ies, 0, False)]
for kind, credential in [('Master', master), ('IES', ies)]:
    for key in ['code', 'token_hash']:
        cases.append((f'{kind} mixed hash {key}', '?keep=1', credential + f'&{key}=synthetic', 0, True))
        cases.append((f'{kind} mixed query {key}', f'?keep=1&{key}=synthetic', credential, 0, True))
cases.extend([
    ('Mixed IES/Master hash', '?keep=1', master + '&' + ies, 0, True),
    ('IES query beside Master hash', '?keep=1&' + ies, master, 0, True),
    ('Master query beside IES hash', '?keep=1&' + master, ies, 0, True),
])
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for name, query, fragment, master_views, ies_empty in cases:
        context = browser.new_context()
        external = []
        def route(request):
            if request.request.url.startswith(root + '/'):
                request.continue_()
            else:
                external.append(request.request.url)
                request.abort()
        context.route('**/*', route)
        page = context.new_page()
        page.goto(root + '/' + query + '#' + fragment)
        expect(page.get_by_role('heading', name='Masters da Vértice', exact=True)).to_be_visible()
        expect(page.get_by_role('heading', name='Convite para Master', exact=True)).to_have_count(master_views)
        assert page.evaluate('window.__verticeIesInvitation.peek() === null') == ies_empty
        assert 'master_token=' not in page.url and 'ies_token=' not in page.url
        assert 'synthetic' not in page.url
        if 'keep=1' in query:
            assert page.evaluate('location.search') == '?keep=1'
        assert not external
        results.append({'name': name, 'passed': True, 'external_requests': len(external)})
        context.close()
    for query, fragment in [('', 'access_token=synthetic&refresh_token=synthetic&type=recovery'), ('?code=synthetic', 'type=recovery'), ('?token_hash=synthetic', 'type=recovery'), ('', 'ies=1'), ('', 'masters=1')]:
        context = browser.new_context()
        page = context.new_page()
        page.goto(root + '/' + query + '#' + fragment)
        expect(page.get_by_role('heading', name='Masters da Vértice', exact=True)).to_be_visible()
        assert page.evaluate('location.search') == query
        assert page.evaluate('location.hash') == '#' + fragment
        expect(page.get_by_role('heading', name='Convite para Master', exact=True)).to_have_count(0)
        results.append({'name': 'Independent Auth/navigation ' + query + '#' + fragment, 'passed': True})
        context.close()
    browser.close()
out.write_text(json.dumps(results, indent=2))
print(json.dumps({'passed': len(results), 'scope': 'local browser fixture; real SDK/Auth not exercised'}))
