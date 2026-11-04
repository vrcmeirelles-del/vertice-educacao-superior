import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=os.environ.get('MASTER_FIXTURE_ORIGIN','http://127.0.0.1:4178')
out=Path(os.environ.get('MASTER_BFCACHE_OUTPUT','/tmp/master-real-bfcache.json'))
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'],ignore_default_args=['--disable-back-forward-cache'])
 c=b.new_context();page=c.new_page();requests=[]
 page.on('request',lambda r:requests.append(r.url))
 c.add_init_script("window.pageEvents=[];window.instanceMarker=Math.random();window.addEventListener('pageshow',e=>window.pageEvents.push({event:'pageshow',persisted:e.persisted}));window.addEventListener('pagehide',e=>window.pageEvents.push({event:'pagehide',persisted:e.persisted}));")
 cdp=c.new_cdp_session(page);cdp.send('Page.enable');misses=[]
 cdp.on('Page.backForwardCacheNotUsed',lambda e:misses.append(e))
 page.goto(root+'/#master_invitation=11111111-1111-4111-8111-111111111111&master_token='+'a'*43)
 expect(page.get_by_role('heading',name='Convite para Master')).to_be_visible()
 page.get_by_label('E-mail da conta Vértice',exact=True).fill('fixture@example.test')
 page.get_by_role('checkbox',name='Conferi',exact=False).check();page.get_by_role('button',name='Criar convite de Master',exact=True).click()
 expect(page.get_by_role('textbox',name='Link do convite',exact=True)).to_be_visible()
 marker=page.evaluate('window.instanceMarker')
 page.goto(root+'/away.html');page.go_back(wait_until='commit')
 expect(page.get_by_role('heading',name='Masters da Vértice')).to_be_visible()
 events=page.evaluate('window.pageEvents');restored=any(e['event']=='pageshow' and e['persisted'] for e in events)
 result={'persisted':restored,'same_instance':page.evaluate('window.instanceMarker')==marker,'events':events,'not_restored_reasons':misses,'issued_link_count':page.get_by_role('textbox',name='Link do convite',exact=True).count(),'received_invitation_count':page.get_by_role('heading',name='Convite para Master').count(),'external_request_count':sum(not u.startswith(root) for u in requests)}
 assert result['issued_link_count']==0 and result['received_invitation_count']==0
 assert result['external_request_count']==0
 if restored:assert result['same_instance']
 out.write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2));b.close()
