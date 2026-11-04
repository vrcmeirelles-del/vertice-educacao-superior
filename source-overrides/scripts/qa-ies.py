import json,base64,time,os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
ROOT=os.environ.get('IES_QA_ORIGIN','http://127.0.0.1:4173').rstrip('/')
OUTPUT=Path(os.environ.get('IES_QA_OUTPUT','/tmp/vertice-ies-qa'));OUTPUT.mkdir(parents=True,exist_ok=True)
UID='11111111-1111-4111-8111-111111111111'
IES='22222222-2222-4222-8222-222222222222'
COURSE='33333333-3333-4333-8333-333333333333'
INV='44444444-4444-4444-8444-444444444444'
TOKEN='a'*64
PREF={k:False for k in ['optional_news_email','optional_news_whatsapp','optional_learning_email','optional_learning_whatsapp']}
def jwt(aal="aal2"):
 def enc(o):return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
 return enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':UID,'aud':'authenticated','role':'authenticated','aal':aal,'exp':int(time.time())+3600,'iat':int(time.time()),'session_id':INV,'amr':[{'method':'totp','timestamp':int(time.time())}]})+'.c2ln'
USER={'id':UID,'aud':'authenticated','role':'authenticated','email':'qa@example.test','email_confirmed_at':'2026-01-01T00:00:00Z','app_metadata':{},'user_metadata':{},'created_at':'2026-01-01T00:00:00Z','factors':[{'id':COURSE,'friendly_name':'QA','factor_type':'totp','status':'verified','created_at':'2026-01-01T00:00:00Z','updated_at':'2026-01-01T00:00:00Z'}]}
SESSION={'access_token':jwt(),'refresh_token':'fixture-refresh-only','expires_in':3600,'expires_at':int(time.time())+3600,'token_type':'bearer','user':USER}
class Fixture:
 def __init__(self,disabled=False,mismatch=False):
  self.hold_write_name=None;self.missing_bootstrap=False;self.signout_error=False;self.detail_error=None;self.mfa_failure=False;self.institutions=None;self.register_error=False;self.global_access=True;self.expired=False;self.preview_error=False;self.hold_preview=False;self.pending=[];self.user=dict(USER);self.disabled=disabled;self.mismatch=mismatch;self.calls=[];self.outbound=[];self.drafts={};self.invites=[];self.accepts=0;self.prefs=dict(PREF)
  self.inst={'institution_id':IES,'name':'Universidade de Teste','emec_code':'123','status':'reviewed','provenance':'manual_unverified'}
 def route(self,route):
  req=route.request;url=req.url
  if url.startswith(ROOT):
   if self.missing_bootstrap and '/ies-invitation-bootstrap.js' in url:return route.fulfill(status=404,body='')
   return route.continue_()
  self.outbound.append(url)
  if 'qvetbbmviatxxatzzuzc.supabase.co' not in url:return route.abort()
  path=urlparse(url).path;data={};status=200
  if path=='/auth/v1/user':data=self.user
  elif path=='/auth/v1/logout':
   if self.signout_error:return route.fulfill(status=422,content_type='application/json',body=json.dumps({'msg':'test signout failure','code':'unexpected_failure'}))
   data={}
  elif path=='/auth/v1/token':data=dict(SESSION,access_token=jwt('aal1'))
  elif path.endswith('/challenge'):data={'id':INV,'expires_at':int(time.time())+300}
  elif path.endswith('/verify'):
   if self.mfa_failure:return route.fulfill(status=422,content_type='application/json',body=json.dumps({'msg':'invalid code','code':'mfa_verification_failed'}))
   data=dict(SESSION,access_token=jwt('aal2'))
  elif path=='/rest/v1/vertice_admins':data=[{'user_id':UID}] if self.global_access else []
  elif '/rest/v1/rpc/' in path:
   name=path.rsplit('/',1)[-1];args=req.post_data_json or {};self.calls.append((name,args))
   if name==self.hold_write_name:
    self.pending.append(route);return
   if name=='vertice_ies_preview_invite' and self.hold_preview:
    self.pending.append(route);return
   if self.disabled:data={'code':'42501','message':'feature_disabled'};status=403
   elif name=='vertice_ies_my_context':data={'assignments':[{'id':INV,'institution_id':IES,'role':'reitor','course_id':None,'capacity':'principal'}],'preferences':self.prefs,'document_adapter_ready':False}
   elif name=='vertice_ies_notices':data=[{'kind':'communications','version':'fixture-communications','body':'Aviso de teste: essenciais são separados; opcionais começam desativados. Sem afirmação de conformidade LGPD.'},{'kind':'double_check','version':'fixture-risk','body':'Aviso de teste: dispensar dupla checagem aumenta o risco documental. A decisão pode ser revertida.'}]
   elif name=='vertice_ies_list_institutions':data=[i for i in self.institutions if not args['p_after'] or i['institution_id']>args['p_after']][:args['p_limit']] if self.institutions is not None else [self.inst]+list(self.drafts.values())
   elif name=='vertice_ies_register':
    if self.register_error:return route.fulfill(status=403,content_type='application/json',body=json.dumps({'message':'access_denied'}),headers={'access-control-allow-origin':'*'})
    d={'institution_id':COURSE,'public_institution_id':None,'name':args['p_name'],'emec_code':args['p_emec_code'],'source_reference':args['p_source_reference'],'status':'pending_review','provenance':'manual_unverified','revision':1};self.drafts[COURSE]=d;data=COURSE
   elif name=='vertice_ies_registration_detail':
    if self.detail_error:return route.fulfill(status=403,content_type='application/json',body=json.dumps({'message':self.detail_error}))
    data=self.drafts.get(args['p_ies'],dict(self.inst,public_institution_id=IES,source_reference=None,revision=2))
   elif name=='vertice_ies_reopen_registration':self.inst['status']='pending_review';data=3
   elif name=='vertice_ies_review_registration':self.drafts[args['p_ies']]['status']='reviewed' if args['p_approve'] else 'rejected';data=None
   elif name=='vertice_ies_list_courses':data=[{'course_id':COURSE,'name':'Direito','code':'456'}]
   elif name=='vertice_ies_list_invites':data=self.invites
   elif name=='vertice_ies_issue_invite':
    self.invites=[{'invitation_id':INV,'recipient_email':args['p_email'],'role':args['p_role'],'course_id':args['p_course'],'capacity':args['p_capacity'],'status':'pending','issued_at':'2026-11-03T12:00:00Z','expires_at':'2030-01-01T00:00:00Z'}];data=[{'invitation_id':INV,'expires_at':'2030-01-01T00:00:00Z'}]
   elif name=='vertice_ies_revoke_invite':
    target=next(i for i in self.invites if i['invitation_id']==args['p_invitation'])
    target['status']='revoked';data=None
   elif name=='vertice_ies_preview_invite':data={'invitation_id':COURSE if self.mismatch else INV,'institution_id':IES,'institution_name':'Universidade de Teste','emec_code':'123','role':'nde','course_id':COURSE,'course_name':'Direito','capacity':'membro','expires_at':'2000-01-01T00:00:00Z' if self.expired else '2030-01-01T00:00:00Z','document_adapter_ready':False}
   elif name=='vertice_ies_accept_invite':self.accepts+=1;data=INV
   elif name=='vertice_ies_set_preferences':self.prefs={k.removeprefix('p_'):v for k,v in args.items()};data=None
   elif name=='vertice_ies_get_review_policy':data={'required':True,'revision':0,'effective_revision':0,'effective_course_id':None,'notice_version':None,'document_adapter_ready':False}
   elif name=='vertice_ies_set_review_policy':data=1
   else:raise AssertionError('Unexpected RPC: '+name)
  else:raise AssertionError('Unexpected network path: '+path)
  route.fulfill(status=status,content_type='application/json',body=json.dumps(data),headers={'access-control-allow-origin':'*'})
def launch_case(browser,fixture,width=1280,authenticated=True):
 ctx=browser.new_context(viewport={'width':width,'height':900})
 ctx.route('**/*',fixture.route)
 if authenticated:ctx.add_init_script('localStorage.setItem("sb-qvetbbmviatxxatzzuzc-auth-token",'+json.dumps(json.dumps(SESSION))+');')
 page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 return ctx,page,errors
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('IES_QA_CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
 # Feature flag fails closed, with no mutation fallback; mobile layout and keyboard.
 f=Fixture(disabled=True);ctx,page,errors=launch_case(browser,f,390)
 page.goto(ROOT+'/master/#ies=1');expect(page.get_by_role('heading',name='Cadastro institucional indisponível')).to_be_visible()
 assert all(name in ['vertice_ies_my_context','vertice_ies_notices','vertice_ies_list_institutions'] for name,args in f.calls)
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 page.keyboard.press('Tab');assert page.evaluate('document.activeElement.tagName')=='BUTTON'
 page.screenshot(path=str(OUTPUT/'qa-disabled-mobile.png'),full_page=True)
 assert not errors,errors;ctx.close();results.append('disabled/mobile/keyboard: passed')
 # Registration draft/review, invitations (hash only), preferences, policy.
 f=Fixture();ctx,page,errors=launch_case(browser,f)
 page.goto(ROOT+'/master/#ies=1');expect(page.get_by_role('heading',name='Universidade de Teste')).to_be_visible()
 page.get_by_role('button',name='Cadastrar instituição',exact=True).click()
 page.get_by_label('Nome da instituição',exact=True).fill('Instituição de Revisão')
 page.get_by_label('Código e-MEC',exact=True).fill('987')
 page.get_by_role('button',name='Revisar dados',exact=True).click()
 assert not any(n=='vertice_ies_register' for n,a in f.calls)
 page.get_by_role('button',name='Corrigir dados').click();expect(page.get_by_label('Nome da instituição',exact=True)).to_have_value('Instituição de Revisão')
 page.get_by_role('button',name='Revisar dados',exact=True).click();page.get_by_role('button',name='Registrar rascunho').click()
 page.get_by_role('button',name='Consultar cadastro confirmado').click()
 expect(page.get_by_role('button',name='Aprovar e consolidar')).to_be_disabled()
 assert not any(n=='vertice_ies_review_registration' for n,a in f.calls)
 page.get_by_label('Revisei os dados acima',exact=False).check();page.get_by_role('button',name='Aprovar e consolidar').click()
 expect(page.get_by_role('heading',name='Instituição de Revisão')).to_be_visible()
 assert next(a for n,a in f.calls if n=='vertice_ies_review_registration')['p_expected_revision']==1
 page.get_by_role('button',name='Gerenciar convites').first.click()
 page.get_by_label('E-mail do destinatário',exact=True).fill('personal@example.test');page.get_by_label('Perfil',exact=True).select_option('nde');page.get_by_label('Composição',exact=True).select_option('membro');page.get_by_label('Curso',exact=True).select_option(COURSE)
 page.get_by_role('button',name='Revisar convite',exact=True).click();page.get_by_role('button',name='Confirmar e gerar link').click()
 expect(page.get_by_label('Link do convite',exact=True)).to_be_visible()
 link=page.get_by_label('Link do convite',exact=True).input_value();assert '#ies_invitation='+INV+'&ies_token=' in link
 args=next(a for n,a in f.calls if n=='vertice_ies_issue_invite');assert set(args)=={'p_ies','p_email','p_role','p_course','p_capacity','p_token_hash'}
 assert len(args['p_token_hash'])==64 and args['p_token_hash']!=link.split('ies_token=')[1]
 page.screenshot(path=str(OUTPUT/'qa-invitation-desktop.png'),full_page=True)
 emitted=link.split('ies_token=')[1]
 page.evaluate("window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}))")
 assert emitted not in page.locator('body').inner_text()
 assert page.get_by_label('Link do convite',exact=True).count()==0
 page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
 expect(page.get_by_role('heading',name='Universidade de Teste',exact=True)).to_be_visible()
 assert emitted not in page.locator('body').inner_text()
 results.append('BFCache pagehide/pageshow removes emitted link: passed')
 page.get_by_role('button',name='Preferências de comunicação',exact=True).click()
 assert not any(page.get_by_label(label,exact=True).is_checked() for label in ['Novidades por e-mail','Novidades por WhatsApp','Conteúdos de aprendizagem por e-mail','Conteúdos de aprendizagem por WhatsApp'])
 page.get_by_label('Novidades por e-mail',exact=True).check();page.get_by_role('button',name='Salvar preferências').click();expect(page.get_by_text('Preferências confirmadas pelo servidor.')).to_be_visible()
 assert next(a for n,a in f.calls if n=='vertice_ies_set_preferences')['p_notice_version']=='fixture-communications'
 page.get_by_role('button',name='Minhas instituições').click();page.get_by_role('button',name='Decisão sobre dupla checagem').click();page.get_by_role('button',name='Consultar política deste escopo').click();page.get_by_label('Exigir dupla checagem',exact=True).uncheck()
 expect(page.get_by_role('button',name='Registrar dispensa neste escopo')).to_be_disabled()
 page.get_by_label('Compreendo o aumento',exact=False).check();page.get_by_label('Confirmo conscientemente',exact=False).check();page.get_by_role('button',name='Registrar dispensa neste escopo').click();expect(page.get_by_text('Decisão registrada pelo servidor.',exact=False)).to_be_visible()
 args=next(a for n,a in f.calls if n=='vertice_ies_set_review_policy');assert args['p_expected_revision']==0 and args['p_notice_version']=='fixture-risk' and args['p_acknowledged'] is True
 assert not errors,errors;ctx.close();results.append('draft/review/invite/preferences/policy: passed')
 # Correct invitation, fragment cleaning, confirmed acceptance.
 f=Fixture();ctx,page,errors=launch_case(browser,f,390)
 page.goto(ROOT+'/master/#ies_invitation='+INV+'&ies_token='+TOKEN)
 expect(page.get_by_role('heading',name='Revisar convite recebido')).to_be_visible();expect(page.get_by_text('Universidade de Teste · e-MEC 123')).to_be_visible()
 assert page.url.endswith('#ies=1');assert all(TOKEN not in u for u in f.outbound)
 assert TOKEN not in page.evaluate('JSON.stringify(localStorage)+JSON.stringify(sessionStorage)')
 expect(page.get_by_role('button',name='Aceitar convite',exact=True)).to_be_disabled()
 page.get_by_label('Conferi a instituição',exact=False).check();page.get_by_role('button',name='Aceitar convite',exact=True).click()
 expect(page.get_by_role('heading',name='Vínculo confirmado')).to_be_visible();assert f.accepts==1
 assert page.evaluate('window.__verticeIesInvitation.peek()') is None
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 assert not errors,errors;ctx.close();results.append('accept/scrub/volatile/mobile: passed')
 # Mismatched preview is rejected without an accept call.
 f=Fixture(mismatch=True);ctx,page,errors=launch_case(browser,f)
 page.goto(ROOT+'/master/#ies_invitation='+INV+'&ies_token='+TOKEN)
 expect(page.get_by_role('alert')).to_contain_text('Convite indisponível')
 assert page.get_by_role('button',name='Aceitar convite',exact=True).count()==0 and f.accepts==0
 ctx.close();results.append('preview UUID mismatch: passed')
 # Expired preview and unconfirmed accounts fail closed.
 f=Fixture();f.expired=True;ctx,page,errors=launch_case(browser,f)
 page.goto(ROOT+'/master/#ies_invitation='+INV+'&ies_token='+TOKEN)
 expect(page.get_by_role('alert')).to_contain_text('Convite indisponível');assert f.accepts==0
 ctx.close();results.append('expired invitation: passed')
 f=Fixture();f.user['email_confirmed_at']=None;ctx,page,errors=launch_case(browser,f)
 page.goto(ROOT+'/master/#ies=1');expect(page.get_by_role('alert')).to_contain_text('Confirme o e-mail');assert f.calls==[]
 ctx.close();results.append('unconfirmed email gate: passed')
 # Scoped academic context works without legacy memberships or global admin.
 f=Fixture();f.global_access=False;ctx,page,errors=launch_case(browser,f)
 page.goto(ROOT+'/master/#ies=1');expect(page.get_by_role('heading',name='Instituições vinculadas à sua conta')).to_be_visible()
 assert page.get_by_role('button',name='Cadastrar instituição',exact=True).count()==0
 expect(page.get_by_role('button',name='Gerenciar convites')).to_be_visible()
 assert not any('vertice_memberships' in u or 'vertice_accept_invites' in u for u in f.outbound)
 ctx.close();results.append('academic context without legacy membership: passed')
 # A fresh fragment on the same document replaces the preview safely.
 f=Fixture();ctx,page,errors=launch_case(browser,f)
 page.goto(ROOT+'/master/#ies=1');expect(page.get_by_role('heading',name='Universidade de Teste')).to_be_visible()
 page.evaluate('(hash)=>{location.hash=hash}', 'ies_invitation='+INV+'&ies_token='+TOKEN)
 expect(page.get_by_role('heading',name='Revisar convite recebido')).to_be_visible()
 expect(page.get_by_text('Universidade de Teste · e-MEC 123')).to_be_visible()
 page.get_by_role('button',name='Fechar convite',exact=True).click()
 expect(page.get_by_role('heading',name='Universidade de Teste')).to_be_visible()
 assert page.evaluate('window.__verticeIesInvitation.peek()') is None
 page.evaluate("location.hash='ies=1'")
 assert page.get_by_role('button',name='Aceitar convite',exact=True).count()==0
 ctx.close();results.append('fresh fragment/close/reopen: passed')
 # Logout while preview is pending invalidates its late response and clears memory.
 f=Fixture();f.hold_preview=True;ctx,page,errors=launch_case(browser,f)
 page.goto(ROOT+'/master/#ies_invitation='+INV+'&ies_token='+TOKEN)
 expect(page.get_by_role('heading',name='Revisar convite recebido')).to_be_visible()
 page.wait_for_timeout(100)
 page.get_by_role('button',name='Sair da conta',exact=True).click()
 expect(page.get_by_role('heading',name='Entrar no Vértice')).to_be_visible()
 assert page.evaluate('window.__verticeIesInvitation.peek()') is None
 for route in f.pending:route.fulfill(status=403,content_type='application/json',body=json.dumps({'message':'invitation_unavailable'}))
 page.wait_for_timeout(100)
 assert page.get_by_role('button',name='Aceitar convite',exact=True).count()==0 and f.accepts==0
 assert not errors,errors
 ctx.close();results.append('logout/late response: passed')
 # Cursor pagination is navigable in both directions without inventing totals.
 f=Fixture();f.institutions=[dict(f.inst,institution_id=f'{n:08x}-2222-4222-8222-222222222222',name=f'IES {n:02}') for n in range(1,22)]
 ctx,page,errors=launch_case(browser,f)
 page.goto(ROOT+'/master/#ies=1');expect(page.get_by_role('heading',name='IES 01',exact=True)).to_be_visible()
 page.get_by_role('button',name='Próxima página').click();expect(page.get_by_role('heading',name='IES 21',exact=True)).to_be_visible()
 expect(page.get_by_role('button',name='Próxima página')).to_be_disabled()
 assert page.get_by_role('heading',name='IES 01',exact=True).count()==0
 page.get_by_role('button',name='Página anterior').click();expect(page.get_by_role('heading',name='IES 01',exact=True)).to_be_visible()
 ctx.close();results.append('keyset next/previous: passed')
 # Failed write never announces registration or consolidation.
 f=Fixture();f.register_error=True;ctx,page,errors=launch_case(browser,f)
 page.goto(ROOT+'/master/#ies=1');page.get_by_role('button',name='Cadastrar instituição',exact=True).click()
 page.get_by_label('Nome da instituição',exact=True).fill('Cadastro recusado');page.get_by_label('Código e-MEC',exact=True).fill('987')
 page.get_by_role('button',name='Revisar dados',exact=True).click();page.get_by_role('button',name='Registrar rascunho').click()
 expect(page.get_by_role('alert')).to_contain_text('não tem autorização')
 assert page.get_by_role('button',name='Aprovar e consolidar').count()==0 and not f.drafts
 ctx.close();results.append('write failure never confirms: passed')
 # Missing blocking script rejects mixed input before Auth bootstraps.
 f=Fixture();f.missing_bootstrap=True;ctx,page,errors=launch_case(browser,f,authenticated=False)
 page.goto(ROOT+'/master/#ies_invitation='+INV+'&ies_token='+TOKEN+'&access_token=AUTH_SENTINEL&refresh_token=REFRESH_SENTINEL&type=recovery&master_token=MASTER_SENTINEL')
 expect(page.get_by_role('alert')).to_contain_text('inicialização segura')
 assert page.url.endswith('#ies=1') and not f.calls and not f.outbound
 assert 'AUTH_SENTINEL' not in page.evaluate('JSON.stringify(localStorage)')
 ctx.close();results.append('missing bootstrap/mixed/Auth isolation: passed')
 # Full no-session password login and MFA, failed code then successful retry.
 f=Fixture();ctx,page,errors=launch_case(browser,f,authenticated=False)
 page.goto(ROOT+'/master/#ies_invitation='+INV+'&ies_token='+TOKEN)
 page.get_by_label('E-mail',exact=True).fill('qa@example.test');page.get_by_label('Senha',exact=True).fill('fixture-password')
 page.get_by_label('Li o aviso de privacidade.',exact=False).check();page.get_by_role('button',name='Entrar',exact=True).click()
 expect(page.get_by_role('heading',name='Confirme seu segundo fator')).to_be_visible();assert f.calls==[]
 f.mfa_failure=True;page.get_by_label('Código do autenticador',exact=True).fill('000000');page.get_by_role('button',name='Validar código').click()
 expect(page.get_by_role('alert')).to_contain_text('Código não validado');expect(page.get_by_role('button',name='Validar código')).to_be_enabled()
 f.mfa_failure=False;page.get_by_label('Código do autenticador',exact=True).fill('123456');page.get_by_role('button',name='Validar código').click()
 expect(page.get_by_role('heading',name='Revisar convite recebido')).to_be_visible();expect(page.get_by_text('Universidade de Teste · e-MEC 123')).to_be_visible()
 assert page.evaluate('window.__verticeIesInvitation.peek() !== null')
 ctx.close();results.append('no-session/login/MFA failure/retry: passed')
 # SPA privacy link clears the invitation and exits the IES gate.
 f=Fixture();ctx,page,errors=launch_case(browser,f,authenticated=False)
 page.goto(ROOT+'/master/#ies_invitation='+INV+'&ies_token='+TOKEN)
 page.get_by_role('link',name='Política de Privacidade e Proteção de Dados',exact=True).click()
 expect(page).to_have_url(ROOT+'/privacidade.html')
 assert page.get_by_role('heading',name='Cadastro e vínculos acadêmicos').count()==0
 assert page.evaluate('window.__verticeIesInvitation.peek()') is None
 ctx.close();results.append('SPA privacy route clears invitation: passed')
 # A confirmed write survives detail failure without showing the register action.
 for failure in ['scope_unavailable','feature_disabled']:
  f=Fixture();ctx,page,errors=launch_case(browser,f)
  page.goto(ROOT+'/master/#ies=1');page.get_by_role('button',name='Cadastrar instituição',exact=True).click()
  page.get_by_label('Nome da instituição',exact=True).fill('Cadastro confirmado');page.get_by_label('Código e-MEC',exact=True).fill('987')
  page.get_by_role('button',name='Revisar dados',exact=True).click();page.get_by_role('button',name='Registrar rascunho').click()
  expect(page.get_by_role('button',name='Consultar cadastro confirmado')).to_be_visible()
  f.detail_error=failure;page.get_by_role('button',name='Consultar cadastro confirmado').click()
  if failure=='feature_disabled':expect(page.get_by_role('heading',name='Cadastro institucional indisponível')).to_be_visible()
  else:expect(page.get_by_role('alert')).to_contain_text('não está disponível')
  assert COURSE in page.locator('body').inner_text()
  assert page.get_by_role('button',name='Registrar rascunho',exact=True).count()==0
  assert len([n for n,a in f.calls if n=='vertice_ies_register'])==1
  assert 'Nenhuma alteração foi realizada' not in page.locator('body').inner_text()
  ctx.close()
 results.append('confirmed write/read failure+disabled: passed')
 # Disabling from a mutation removes the entire workspace and prevents resubmission.
 f=Fixture();ctx,page,errors=launch_case(browser,f)
 page.goto(ROOT+'/master/#ies=1');page.get_by_role('button',name='Preferências de comunicação',exact=True).click()
 f.disabled=True;page.get_by_role('button',name='Salvar preferências').click()
 expect(page.get_by_role('heading',name='Cadastro institucional indisponível')).to_be_visible()
 assert page.get_by_role('button',name='Salvar preferências').count()==0
 ctx.close();results.append('disabled during mutation invalidates context: passed')
 # Signout failure offers explicit reentry with a new working API, no stale secret.
 f=Fixture();f.signout_error=True;ctx,page,errors=launch_case(browser,f)
 page.goto(ROOT+'/master/#ies_invitation='+INV+'&ies_token='+TOKEN)
 expect(page.get_by_text('Universidade de Teste · e-MEC 123')).to_be_visible();page.get_by_role('button',name='Sair da conta',exact=True).click()
 expect(page.get_by_role('alert')).to_contain_text('Não foi possível confirmar o encerramento')
 assert page.evaluate('window.__verticeIesInvitation.peek()') is None
 expect(page.get_by_role('heading',name='Entrar no Vértice')).to_be_visible()
 ctx.close();results.append('signout failure/reentry: passed')
 # A replacement fragment during the pre-accept preview cannot switch the token.
 f=Fixture();ctx,page,errors=launch_case(browser,f)
 page.goto(ROOT+'/master/#ies_invitation='+INV+'&ies_token='+TOKEN)
 expect(page.get_by_text('Universidade de Teste · e-MEC 123')).to_be_visible()
 page.get_by_label('Conferi a instituição',exact=False).check();f.hold_preview=True
 page.get_by_role('button',name='Aceitar convite',exact=True).click();page.wait_for_timeout(100)
 token_b='b'*64
 page.evaluate('(hash)=>{location.hash=hash}', 'ies_invitation='+INV+'&ies_token='+token_b)
 page.wait_for_timeout(100)
 for route in list(f.pending):
  route.fulfill(status=200,content_type='application/json',body=json.dumps({'invitation_id':INV,'institution_id':IES,'institution_name':'Universidade de Teste','emec_code':'123','role':'nde','course_id':COURSE,'course_name':'Direito','capacity':'membro','expires_at':'2030-01-01T00:00:00Z','document_adapter_ready':False}))
 page.wait_for_timeout(200)
 assert f.accepts==0
 expect(page.get_by_role('button',name='Aceitar convite',exact=True)).to_be_disabled()
 assert not errors,errors
 ctx.close();results.append('fragment replacement during pending preview: passed')
 # Reopen confirmation is retained independently from the next detail read.
 f=Fixture();f.inst['status']='rejected';ctx,page,errors=launch_case(browser,f)
 page.goto(ROOT+'/master/#ies=1');page.get_by_role('button',name='Revisar cadastro',exact=True).click()
 page.get_by_role('button',name='Reabrir revisão da instituição existente').click()
 expect(page.get_by_role('button',name='Consultar cadastro confirmado')).to_be_visible()
 f.detail_error='scope_unavailable';page.get_by_role('button',name='Consultar cadastro confirmado').click()
 expect(page.get_by_role('alert')).to_contain_text('não está disponível')
 assert 'Revisão 3' in page.locator('body').inner_text()
 assert page.get_by_role('button',name='Reabrir revisão da instituição existente').count()==0
 assert len([n for n,a in f.calls if n=='vertice_ies_reopen_registration'])==1
 ctx.close();results.append('reopen confirmed/detail failure: passed')
 # Same email/profile in different courses has distinct visible/revocation scopes.
 f=Fixture();f.invites=[{'invitation_id':iid,'recipient_email':'same@example.test','role':'nde','course_id':cid,'capacity':'membro','status':'pending','issued_at':'2026-11-03T12:00:00Z','expires_at':'2030-01-01T00:00:00Z'} for iid,cid in [(INV,COURSE),(UID,UID)]]
 ctx,page,errors=launch_case(browser,f);page.goto(ROOT+'/master/#ies=1');page.get_by_role('button',name='Gerenciar convites').click()
 expect(page.get_by_role('button',name='Revogar convite de same@example.test',exact=False)).to_have_count(2)
 target=page.get_by_role('button',name='Revogar convite de same@example.test',exact=False).filter(has_text='Curso ID '+UID)
 target.click();expect(page.get_by_text('Confirma revogar',exact=False)).to_contain_text('Curso ID '+UID)
 page.get_by_role('button',name='Confirmar revogação',exact=False).click()
 expect(page.get_by_text('Revogação confirmada.',exact=True)).to_be_visible()
 assert next(a for n,a in f.calls if n=='vertice_ies_revoke_invite')['p_invitation']==UID
 assert {i['invitation_id']:i['status'] for i in f.invites}=={INV:'pending',UID:'revoked'}
 expect(page.get_by_role('button',name='Revogar convite de same@example.test',exact=False)).to_have_count(1)
 expect(page.get_by_role('button',name='Revogar convite de same@example.test',exact=False)).to_contain_text('Direito')
 ctx.close();results.append('distinct invitation course/revoke fallback: passed')
 # Internal navigation and Close are blocked until an issued link can be shown.
 f=Fixture();ctx,page,errors=launch_case(browser,f);page.goto(ROOT+'/master/#ies=1');page.get_by_role('button',name='Gerenciar convites').click()
 page.get_by_label('E-mail do destinatário',exact=True).fill('issue@example.test');page.get_by_role('button',name='Revisar convite',exact=True).click()
 f.hold_write_name='vertice_ies_issue_invite';page.get_by_role('button',name='Confirmar e gerar link').click()
 expect(page.get_by_role('button',name='Preferências de comunicação',exact=True)).to_be_disabled();expect(page.get_by_role('button',name='Fechar área IES')).to_be_disabled()
 page.get_by_role('button',name='Preferências de comunicação',exact=True).evaluate('(b)=>b.click()')
 assert page.get_by_role('heading',name='Convites · Universidade de Teste').count()==1
 for route in f.pending:route.fulfill(status=200,content_type='application/json',body=json.dumps([{'invitation_id':INV,'expires_at':'2030-01-01T00:00:00Z'}]))
 expect(page.get_by_label('Link do convite',exact=True)).to_be_visible();expect(page.get_by_role('button',name='Fechar área IES')).to_be_enabled()
 ctx.close();results.append('pending issue blocks internal navigation: passed')
 # Close is blocked during registration, while security logout remains available.
 f=Fixture();ctx,page,errors=launch_case(browser,f);page.goto(ROOT+'/master/#ies=1');page.get_by_role('button',name='Cadastrar instituição',exact=True).click()
 page.get_by_label('Nome da instituição',exact=True).fill('Registro pendente');page.get_by_label('Código e-MEC',exact=True).fill('789');page.get_by_role('button',name='Revisar dados',exact=True).click()
 f.hold_write_name='vertice_ies_register';page.get_by_role('button',name='Registrar rascunho').click()
 expect(page.get_by_role('button',name='Fechar área IES')).to_be_disabled();expect(page.get_by_role('button',name='Sair da conta',exact=True)).to_be_enabled()
 page.get_by_role('button',name='Sair da conta',exact=True).click();expect(page.get_by_role('heading',name='Entrar no Vértice')).to_be_visible()
 expect(page.get_by_role('alert')).to_contain_text('pode concluir no servidor')
 for route in f.pending:route.fulfill(status=200,content_type='application/json',body=json.dumps(COURSE))
 page.wait_for_timeout(100);assert page.get_by_role('button',name='Consultar cadastro confirmado').count()==0
 ctx.close();results.append('pending register/close/security logout: passed')
 # Both scrubbers reject Auth code/hash mixed with IES; no SDK exchange or telemetry.
 for key in ['code','token_hash']:
  for placement in ['query','fragment']:
   f=Fixture();ctx,page,errors=launch_case(browser,f,authenticated=False)
   query=('?'+key+'=AUTH_CODE_SENTINEL&keep=1') if placement=='query' else ''
   fragment='#ies_invitation='+INV+'&ies_token='+TOKEN+('&'+key+'=AUTH_CODE_SENTINEL' if placement=='fragment' else '')
   page.goto(ROOT+'/master/'+query+fragment)
   expect(page.get_by_role('alert')).to_contain_text('parâmetros inválidos ou misturados')
   assert 'AUTH_CODE_SENTINEL' not in page.url and TOKEN not in page.url
   assert page.evaluate('window.__verticeIesInvitation.peek()') is None
   assert f.outbound==[] and f.calls==[]
   assert not errors,errors
   ctx.close()
 results.append('Auth code/token_hash query+fragment mixed input rejected: passed')
 browser.close()
(OUTPUT/'qa-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print('\n'.join(results))
