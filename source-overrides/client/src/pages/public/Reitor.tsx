import React from "react";
import {PublicHeading} from '@/components/PublicLayout';
import EbitdaCalculator from '@/components/EbitdaCalculator';
export default function Reitor(){return <><PublicHeading eyebrow="ÁREA DO REITOR" title="Números claros para decidir melhor." text="Calcule o EBITDA e a margem da sua instituição. Comece pela DRE e, se precisar, detalhe as receitas e os custos da operação educacional."/><div className="corp-container corp-section"><EbitdaCalculator/></div></>;}
