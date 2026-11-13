import { Children, cloneElement, forwardRef, isValidElement, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { fieldGuidance, findHelp, helpAnchor } from '@/lib/contextual-help';
import './context-help.css';

export function ContextHelp({title,text}:{title:string;text?:string}) {
  const [open,setOpen]=useState(false);
  const id=useId();
  const trigger=useRef<HTMLButtonElement>(null);
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild><button ref={trigger} type="button" className="vx-help-dot" aria-label={`Ajuda: ${title}`} aria-expanded={open} aria-controls={open?id:undefined} aria-haspopup="dialog" onClick={e=>e.stopPropagation()}>?</button></Popover.Trigger>
    <Popover.Portal><Popover.Content id={id} className="vx-help-card" sideOffset={7} collisionPadding={16} aria-label={`Explicação: ${title}`} onClick={e=>e.stopPropagation()}>
      <div className="vx-help-top"><strong>{title}</strong><Popover.Close type="button" aria-label="Fechar ajuda">×</Popover.Close></div>
      <p>{text || findHelp(title) || fieldGuidance(title)}</p>
      <a href={`/guia.html${findHelp(title)?`#${helpAnchor(title)}`:'#campos-dos-formularios'}`} target="_blank" rel="noopener noreferrer">Consultar guia e glossário ↗</a>
      <small>Explicação pronta · sem consulta à IA</small>
      <Popover.Arrow className="vx-help-arrow" />
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}

function labelText(children:ReactNode):string {
  return Children.toArray(children).map(child=>{
    if(typeof child==='string'||typeof child==='number')return String(child);
    if(!isValidElement<{children?:ReactNode}>(child))return '';
    if(typeof child.type==='string'&&['input','select','textarea','small','button','svg','option','em'].includes(child.type))return '';
    return labelText(child.props.children);
  }).join(' ').replace(/\s+/g,' ').trim();
}
function controlProps(children:ReactNode):Record<string,any>|undefined {
  for(const child of Children.toArray(children)){
    if(!isValidElement<{children?:ReactNode}>(child))continue;
    if(typeof child.type==='string'&&['input','select','textarea'].includes(child.type))return {...child.props,kind:child.type};
    const nested=controlProps(child.props.children);if(nested)return nested;
  }
}
/** Native label semantics and original children/handlers are preserved; help never submits the form. */
export const HelpLabel=forwardRef<HTMLLabelElement,ComponentProps<'label'>&{help?:string}>(function HelpLabel({children,help,...props},ref){
  const captionId=useId();
  const fieldId=useId();
  const control=controlProps(children);
  let bound=false;
  function bindControls(items:ReactNode):ReactNode {
    return Children.map(items,child=>{
      if(!isValidElement<Record<string,any>>(child))return child;
      if(!bound&&typeof child.type==='string'&&['input','select','textarea'].includes(child.type)){
        bound=true;
        return cloneElement(child,{id:child.props.id||props.htmlFor||fieldId,...(!child.props['aria-label']&&!child.props['aria-labelledby']?{'aria-labelledby':captionId}:{})});
      }
      return child.props.children?cloneElement(child,{},bindControls(child.props.children)):child;
    });
  }
  const title=labelText(children)||String(props['aria-label']||control?.['aria-label']||control?.placeholder||'Preenchimento do campo');
  const nodes=Children.toArray(bindControls(children));
  const firstControl=nodes.findIndex(child=>isValidElement(child)&&typeof child.type==='string'&&['input','select','textarea'].includes(child.type));
  const dot=<ContextHelp key="context-help" title={title} text={help||fieldGuidance(title,control?.kind==='select'?'select':control?.type,control?.required)} />;
  // Keep checkboxes next to their caption; put the help before full-width controls.
  const caption=(parts:ReactNode[]) => <span className="vx-help-caption">{parts}{dot}</span>;
  return <label {...props} htmlFor={props.htmlFor||control?.id||(control?fieldId:undefined)} ref={ref} className={[props.className,'vx-help-label'].filter(Boolean).join(' ')}><span id={captionId} hidden>{title}</span>{firstControl>0?<>{caption(nodes.slice(0,firstControl))}{nodes.slice(firstControl)}</>:firstControl===0?<>{nodes[0]}{caption(nodes.slice(1))}</>:caption(nodes)}</label>;
});

export function IndicatorHelp({title,description}:{title:string;description?:string}) { return <ContextHelp title={title} text={findHelp(title)||description||"Consulte este indicador no período e na instituição selecionados. Confira a unidade, a fonte e a data de atualização antes de comparar. Valores ausentes não equivalem a zero. Para uma dúvida adicional, use o campo de perguntar à IA."}/>; }
