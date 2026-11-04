begin;
do $$ declare png bytea := decode('iVBORw0KGgoAAAANSUhEUgAAASwAAAB4CAYAAABIFc8gAAABd0lEQVR4Ae3BQRGAMAADsK5PFE82DkBH75Kc9z5fAAY0ACMagBENwIgGYEQDMKIBGNEAjGgARjQAIxqAEQ3AiAZgRAMwogEY0QCMaABGNAAjGoARDcCIBmBEAzCiARjRAIxoAEY0ACMagBENwIgGYEQDMKIBGNEAjGgARjQAIxqAEQ3AiAZgRAMwogEY0QCMaABGNAAjGoARDcCIBmBEAzCiARjRAIxoAEY0ACMagBENwIgGYEQDMKIBGNEAjGgARjQAIxqAEQ3AiAZgRAMwogEY0QCMaABGNAAjGoARDcCIBmBEAzCiARjRAIxoAEY0ACMagBENwIgGYEQDMKIBGNEAjGgARjQAIxqAEQ3AiAZgRAMwogEY0QCMaABGNAAjGoARDcCIBmBEAzCiARjRAIxoAEY0ACMagBENwIgGYEQDMKIBGNEAjGgARjQAIxqAEQ3AiAZgRAMwogEY0QCMaABGNAAjGoARDcCIBmBEAzCiARjRAIz4AeDOA2GtMrv9AAAAAElFTkSuQmCC','base64'); value jsonb; begin
 value:=jsonb_build_object('header_text','Synthetic','theme_color',null,'logo_data','data:image/png;base64,'||replace(encode(png,'base64'),E'\n',''));
 if not vertice_private.valid_document_branding(value) then raise exception 'FAIL valid normalized PNG'; end if;
 value:=jsonb_set(value,'{logo_data}',to_jsonb('data:image/png;base64,'||replace(encode(set_byte(png,45,get_byte(png,45)#1),'base64'),E'\n','')));
 if vertice_private.valid_document_branding(value) then raise exception 'FAIL PNG CRC'; end if;
 value:=jsonb_set(value,'{logo_data}',to_jsonb('data:image/png;base64,'||replace(encode(set_byte(png,19,10),'base64'),E'\n','')));
 if vertice_private.valid_document_branding(value) then raise exception 'FAIL PNG dimensions'; end if;
 -- Valid CRCs, 200 KB controlled inflated data, rejected on IHDR before raster decoding.
 value:=jsonb_set(value,'{logo_data}',to_jsonb('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAB4CAYAAAE/Ev+2AAAA2UlEQVR4nO3BMQEAAADCoPVPbQZ/oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACA1wANbQABcCDKwQAAAABJRU5ErkJggg=='::text));
 if vertice_private.valid_document_branding(value) then raise exception 'FAIL interlaced PNG'; end if;
end $$;
rollback;
select 'PASS: normalized PNG, CRC corruption, invalid dimensions, CRC-valid interlaced payload' as validation;
