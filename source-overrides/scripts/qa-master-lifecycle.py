import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=os.environ.get('MASTER_FIXTURE_ORIGIN','http://127.0.0.1:4178')
out=Path(os.environ.get('MASTER_FIXTURE_OUTPUT','/tmp/master-lifecycle-results.json'))
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 def launch():
  c=b.new_context();c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(root) else r.abort())
  page=c.new_page();page.goto(root+'/#master_invitation=11111111-1111-4111-8111-111111111111&master_token='+'a'*43)
  expect(page.get_by_role('heading',name='Convite para Master')).to_be_visible()
  expect(page.get_by_label('E-mail da conta Vértice',exact=True)).to_be_enabled()
  return c,page
 def issue(page):
  page.get_by_label('E-mail da conta Vértice',exact=True).fill('fixture@example.test')
  page.get_by_role('checkbox',name='Conferi',exact=False).check()
  page.get_by_role('button',name='Criar convite de Master',exact=True).click()
 c,page=launch();issue(page);expect(page.get_by_role('textbox',name='Link do convite',exact=True)).to_have_value('https://example.test/master#master_token=EMITTED_FIXTURE_SECRET')
 page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))")
 assert page.get_by_role('textbox',name='Link do convite',exact=True).count()==0
 assert page.get_by_role('heading',name='Convite para Master').count()==0
 page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
 expect(page.get_by_role('heading',name='Masters da Vértice')).to_be_visible()
 assert page.get_by_role('textbox',name='Link do convite',exact=True).count()==0
 assert page.get_by_role('heading',name='Convite para Master').count()==0
 c.close();results.append('pagehide removes received/issued secrets and DOM; persisted return fresh: passed')
 c,page=launch();page.evaluate('window.holdIssue=true');issue(page)
 page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.releaseIssue()")
 page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
 expect(page.get_by_role('heading',name='Masters da Vértice')).to_be_visible()
 assert page.get_by_role('textbox',name='Link do convite',exact=True).count()==0
 assert page.evaluate('window.issues')==1
 c.close();results.append('late issue result cannot revive BFCache secret: passed')
 c,page=launch();page.evaluate("""() => {
  window.useRealIssue=true;window.rpcCalls=0;window.realIssueSettled=false;
  const digest=crypto.subtle.digest.bind(crypto.subtle);
  crypto.subtle.digest=(...args)=>new Promise((resolve,reject)=>{
   window.digestPending=true;
   window.releaseDigest=()=>digest(...args).then(resolve,reject);
  });
 }""")
 issue(page);page.wait_for_function('window.digestPending===true')
 assert page.evaluate('window.rpcCalls')==0
 page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))")
 page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
 expect(page.get_by_role('heading',name='Masters da Vértice')).to_be_visible()
 page.evaluate('window.releaseDigest()');page.wait_for_function('window.realIssueSettled===true')
 assert page.evaluate('window.rpcCalls')==0
 assert page.get_by_role('textbox',name='Link do convite',exact=True).count()==0
 assert page.get_by_role('heading',name='Convite para Master').count()==0
 c.close();results.append('real issuance function with held digest: pagehide/return/release sends zero RPC: passed')
 for event,uid in [('SIGNED_OUT',None),('SIGNED_IN','22222222-2222-4222-8222-222222222222')]:
  c,page=launch();issue(page);expect(page.get_by_role('textbox',name='Link do convite',exact=True)).to_be_visible()
  page.evaluate('args=>window.authEvent(...args)',[event,uid])
  expect(page.get_by_role('textbox',name='Link do convite',exact=True)).to_have_count(0)
  expect(page.get_by_role('heading',name='Convite para Master')).to_have_count(0)
  c.close();results.append(event+' removes received/issued secrets: passed')
 b.close()
out.write_text(json.dumps(results,indent=2));print('\n'.join(results))
