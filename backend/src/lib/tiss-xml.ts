import { createHash } from "node:crypto";

// ─── Tipos internos ───────────────────────────────────────────────────────────

export interface TissClinica {
  cnpj: string;
  cnes: string;
  razaoSocial: string;
}

export interface TissOperadora {
  registroANS: string;           // 6 dígitos
  codigoPrestador: string;       // código do prestador nesta operadora
}

export interface TissGuiaConsulta {
  numeroGuia: string;
  numeroAutorizacao?: string;
  dataAtendimento: string;       // "YYYY-MM-DD"
  nomeBeneficiario: string;
  numeroCarteirinha: string;
  validadeCarteirinha?: string;  // "MM/YYYY" → convertido para "YYYY-MM"
  tipoConsulta: number;          // 1=1º atend, 2=retorno, 3=pré-natal
  indicacaoAcidente: number;     // 9=outros, 1=trabalho, 2=trânsito
  valorConsulta: number;
  tussCode?: string;
  nomeExecutante: string;
  crmExecutante: string;
  crmEstado: string;
  cbos?: string;
  codigoPrestador?: string;
}

export interface TissGuiaSPSADT {
  numeroGuia: string;
  numeroAutorizacao?: string;
  dataAtendimento: string;
  nomeBeneficiario: string;
  numeroCarteirinha: string;
  validadeCarteirinha?: string;
  indicacaoAcidente: number;
  nomeExecutante: string;
  crmExecutante: string;
  crmEstado: string;
  cbos?: string;
  codigoPrestador?: string;
  procedimentos: Array<{
    tussCode: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }>;
  valorTotal: number;
}

export interface TissLote {
  numeroLote: number;
  competencia: string;  // "YYYY-MM"
  operadora: TissOperadora;
  clinica: TissClinica;
  guiasConsulta: TissGuiaConsulta[];
  guiasSPSADT: TissGuiaSPSADT[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  return v.toFixed(2);
}

function fmtDate(iso: string): string {
  return iso.substring(0, 10);
}

function validadeToISO(val?: string): string {
  if (!val) return "";
  // "MM/YYYY" → "YYYY-MM"
  const [mm, yyyy] = val.split("/");
  return `${yyyy}-${mm}`;
}

// ─── Blocos XML ───────────────────────────────────────────────────────────────

function guiaConsultaXml(g: TissGuiaConsulta): string {
  const validade = validadeToISO(g.validadeCarteirinha);
  return `
        <ans:guiaConsulta>
          <ans:cabecalhoGuia>
            <ans:registroANSOperadora><!-- ans:registroANS --></ans:registroANSOperadora>
            <ans:numeroGuiaPrestador>${g.numeroGuia}</ans:numeroGuiaPrestador>
            ${g.numeroAutorizacao ? `<ans:numeroGuiaOperadora>${g.numeroAutorizacao}</ans:numeroGuiaOperadora>` : ""}
          </ans:cabecalhoGuia>
          <ans:dadosBeneficiario>
            <ans:numeroCarteira>${g.numeroCarteirinha}</ans:numeroCarteira>
            ${validade ? `<ans:validadeCarteira>${validade}</ans:validadeCarteira>` : ""}
            <ans:atendimentoRN>N</ans:atendimentoRN>
            <ans:nomeBeneficiario>${esc(g.nomeBeneficiario)}</ans:nomeBeneficiario>
          </ans:dadosBeneficiario>
          <ans:dadosSolicitante>
            <ans:contratadoSolicitante>
              <ans:codigoPrestadorNaOperadora>${g.codigoPrestador ?? ""}</ans:codigoPrestadorNaOperadora>
            </ans:contratadoSolicitante>
            <ans:profissionalSolicitante>
              <ans:nomeProfissional>${esc(g.nomeExecutante)}</ans:nomeProfissional>
              <ans:conselhoProfissional>CRM</ans:conselhoProfissional>
              <ans:numeroConselho>${g.crmExecutante}</ans:numeroConselho>
              <ans:UF>${g.crmEstado}</ans:UF>
              <ans:CBOS>${g.cbos ?? "225125"}</ans:CBOS>
            </ans:profissionalSolicitante>
          </ans:dadosSolicitante>
          <ans:dadosAtendimento>
            <ans:indicacaoAcidente>${g.indicacaoAcidente}</ans:indicacaoAcidente>
            <ans:dataAtendimento>${g.dataAtendimento}</ans:dataAtendimento>
            <ans:localAtendimento>01</ans:localAtendimento>
            <ans:tipoConsulta>${g.tipoConsulta}</ans:tipoConsulta>
            ${g.tussCode ? `<ans:codigoProcedimento>${g.tussCode}</ans:codigoProcedimento>` : ""}
            <ans:valorConsulta>${fmt(g.valorConsulta)}</ans:valorConsulta>
          </ans:dadosAtendimento>
          <ans:valorTotal>
            <ans:valorTotalGeral>${fmt(g.valorConsulta)}</ans:valorTotalGeral>
          </ans:valorTotal>
        </ans:guiaConsulta>`;
}

function guiaSPSADTXml(g: TissGuiaSPSADT): string {
  const validade = validadeToISO(g.validadeCarteirinha);
  const procs = g.procedimentos.map(p => `
            <ans:procedimentosExecutados>
              <ans:sequencialItem>1</ans:sequencialItem>
              <ans:dataExecucao>${g.dataAtendimento}</ans:dataExecucao>
              <ans:procedimento>
                <ans:codigoTabela>22</ans:codigoTabela>
                <ans:codigoProcedimento>${p.tussCode}</ans:codigoProcedimento>
                <ans:descricaoProcedimento>${esc(p.descricao)}</ans:descricaoProcedimento>
              </ans:procedimento>
              <ans:quantidadeExecutada>${p.quantidade}</ans:quantidadeExecutada>
              <ans:valorUnitario>${fmt(p.valorUnitario)}</ans:valorUnitario>
              <ans:valorTotal>${fmt(p.valorTotal)}</ans:valorTotal>
            </ans:procedimentosExecutados>`).join("");

  return `
        <ans:guiaSP-SADT>
          <ans:cabecalhoGuia>
            <ans:registroANSOperadora><!-- ans:registroANS --></ans:registroANSOperadora>
            <ans:numeroGuiaPrestador>${g.numeroGuia}</ans:numeroGuiaPrestador>
            ${g.numeroAutorizacao ? `<ans:numeroGuiaOperadora>${g.numeroAutorizacao}</ans:numeroGuiaOperadora>` : ""}
          </ans:cabecalhoGuia>
          <ans:dadosBeneficiario>
            <ans:numeroCarteira>${g.numeroCarteirinha}</ans:numeroCarteira>
            ${validade ? `<ans:validadeCarteira>${validade}</ans:validadeCarteira>` : ""}
            <ans:atendimentoRN>N</ans:atendimentoRN>
            <ans:nomeBeneficiario>${esc(g.nomeBeneficiario)}</ans:nomeBeneficiario>
          </ans:dadosBeneficiario>
          <ans:dadosSolicitante>
            <ans:contratadoSolicitante>
              <ans:codigoPrestadorNaOperadora>${g.codigoPrestador ?? ""}</ans:codigoPrestadorNaOperadora>
            </ans:contratadoSolicitante>
            <ans:profissionalSolicitante>
              <ans:nomeProfissional>${esc(g.nomeExecutante)}</ans:nomeProfissional>
              <ans:conselhoProfissional>CRM</ans:conselhoProfissional>
              <ans:numeroConselho>${g.crmExecutante}</ans:numeroConselho>
              <ans:UF>${g.crmEstado}</ans:UF>
              <ans:CBOS>${g.cbos ?? "225125"}</ans:CBOS>
            </ans:profissionalSolicitante>
          </ans:dadosSolicitante>
          <ans:dadosAtendimento>
            <ans:indicacaoAcidente>${g.indicacaoAcidente}</ans:indicacaoAcidente>
            <ans:dataAtendimento>${g.dataAtendimento}</ans:dataAtendimento>
            <ans:tipoAtendimento>03</ans:tipoAtendimento>
            <ans:indicacaoClinica>2</ans:indicacaoClinica>
          </ans:dadosAtendimento>
          <ans:dadosExecucao>
            <ans:dadosContratadoExecutante>
              <ans:codigoPrestadorNaOperadora>${g.codigoPrestador ?? ""}</ans:codigoPrestadorNaOperadora>
            </ans:dadosContratadoExecutante>
            <ans:identificacaoEquipe>
              <ans:sequencialEquipe>1</ans:sequencialEquipe>
              <ans:grauParticipacao>00</ans:grauParticipacao>
              <ans:codigoProfissional>
                <ans:conselhoProfissional>CRM</ans:conselhoProfissional>
                <ans:numeroConselho>${g.crmExecutante}</ans:numeroConselho>
                <ans:UF>${g.crmEstado}</ans:UF>
                <ans:CBOS>${g.cbos ?? "225125"}</ans:CBOS>
              </ans:codigoProfissional>
              ${procs}
            </ans:identificacaoEquipe>
          </ans:dadosExecucao>
          <ans:valorTotal>
            <ans:valorTotalGeral>${fmt(g.valorTotal)}</ans:valorTotalGeral>
          </ans:valorTotal>
        </ans:guiaSP-SADT>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── Gerador principal ────────────────────────────────────────────────────────

export function gerarXmlTiss(lote: TissLote, sequencial = 1): string {
  const now = new Date();
  const dataHoje = fmtDate(now.toISOString());
  const hora = now.toTimeString().substring(0, 8);

  const guiasXml = [
    ...lote.guiasConsulta.map(g =>
      guiaConsultaXml(g).replace(
        /<!-- ans:registroANS -->/g,
        lote.operadora.registroANS
      )
    ),
    ...lote.guiasSPSADT.map(g =>
      guiaSPSADTXml(g).replace(
        /<!-- ans:registroANS -->/g,
        lote.operadora.registroANS
      )
    ),
  ].join("\n");

  const prestadorPart = `
  <ans:prestadorParaOperadora>
    <ans:loteGuias>
      <ans:numeroLote>${lote.numeroLote}</ans:numeroLote>
      <ans:guiasTISS>${guiasXml}
      </ans:guiasTISS>
    </ans:loteGuias>
  </ans:prestadorParaOperadora>`;

  const hash = createHash("md5").update(prestadorPart).digest("hex");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ans:mensagemTISS
  xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.ans.gov.br/padroes/tiss/schemas tissV3_05_00.xsd">
  <ans:cabecalho>
    <ans:identificacaoTransacao>
      <ans:tipoTransacao>ENVIO_LOTE_GUIAS</ans:tipoTransacao>
      <ans:sequencialTransacao>${sequencial}</ans:sequencialTransacao>
      <ans:dataRegistroTransacao>${dataHoje}</ans:dataRegistroTransacao>
      <ans:horaRegistroTransacao>${hora}</ans:horaRegistroTransacao>
    </ans:identificacaoTransacao>
    <ans:origem>
      <ans:identificacaoPrestador>
        <ans:codigoPrestadorNaOperadora>${lote.operadora.codigoPrestador}</ans:codigoPrestadorNaOperadora>
      </ans:identificacaoPrestador>
    </ans:origem>
    <ans:destino>
      <ans:registroANS>${lote.operadora.registroANS}</ans:registroANS>
    </ans:destino>
    <ans:Padrao>3.05.00</ans:Padrao>
  </ans:cabecalho>
${prestadorPart}
  <ans:epilogo>
    <ans:hash>${hash}</ans:hash>
  </ans:epilogo>
</ans:mensagemTISS>`;
}
