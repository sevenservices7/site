-- Formulário estilo G4: o lead nasce com nome e e-mail; o WhatsApp chega na pergunta seguinte.
alter table public.leads alter column phone drop not null;
