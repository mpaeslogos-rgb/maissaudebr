/**
 * Seed — Catálogo de Exames Laboratoriais
 * Execução: node scripts/seed-exam-catalog.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const exames = [
  // ── HEMATOLOGIA ───────────────────────────────────────────────────────────
  { name: 'Hemograma completo',                description: 'Série vermelha, branca e plaquetas com diferencial',   price: 40,  duration: 15, category: 'Hematologia' },
  { name: 'Reticulócitos',                     description: 'Contagem de reticulócitos',                           price: 35,  duration: 15, category: 'Hematologia' },
  { name: 'VHS (Velocidade de Hemossedimentação)', description: 'Marcador inespecífico de inflamação',             price: 30,  duration: 15, category: 'Hematologia' },
  { name: 'Coagulograma (TP + TTPA)',          description: 'Tempo de protrombina e tempo de tromboplastina parcial ativada', price: 55, duration: 15, category: 'Hematologia' },
  { name: 'D-Dímero',                          description: 'Produto de degradação da fibrina',                    price: 70,  duration: 15, category: 'Hematologia' },
  { name: 'Fibrinogênio',                      description: 'Fator de coagulação e marcador inflamatório',         price: 55,  duration: 15, category: 'Hematologia' },

  // ── GLICEMIA E METABOLISMO ────────────────────────────────────────────────
  { name: 'Glicemia em jejum',                 description: 'Glicose plasmática após 8h de jejum',                 price: 25,  duration: 15, category: 'Metabólico' },
  { name: 'Hemoglobina glicada (HbA1c)',       description: 'Média glicêmica dos últimos 2–3 meses',               price: 55,  duration: 15, category: 'Metabólico' },
  { name: 'Insulina basal',                    description: 'Insulina plasmática em jejum',                        price: 55,  duration: 15, category: 'Metabólico' },
  { name: 'HOMA-IR (cálculo)',                 description: 'Índice de resistência à insulina (glicemia + insulina)', price: 90, duration: 15, category: 'Metabólico' },
  { name: 'Curva glicêmica 75g (2 pontos)',    description: 'Basal + 120 min — diagnóstico de DM e pré-DM',        price: 75,  duration: 15, category: 'Metabólico' },
  { name: 'Curva de insulina 75g (3 pontos)',  description: 'Basal + 60 + 120 min — resistência insulínica',       price: 145, duration: 15, category: 'Metabólico' },
  { name: 'Peptídeo C',                        description: 'Avaliação da função das células beta',                price: 65,  duration: 15, category: 'Metabólico' },
  { name: 'Frutosamina',                       description: 'Controle glicêmico das últimas 2–3 semanas',          price: 50,  duration: 15, category: 'Metabólico' },

  // ── LIPIDOGRAMA ────────────────────────────────────────────────────────────
  { name: 'Colesterol total e frações',        description: 'Total, HDL, LDL (calculado) e VLDL',                  price: 55,  duration: 15, category: 'Lipidograma' },
  { name: 'Triglicérides',                     description: 'Triglicerídeos séricos em jejum',                     price: 30,  duration: 15, category: 'Lipidograma' },
  { name: 'LDL direto',                        description: 'LDL medido diretamente (sem fórmula de Friedewald)', price: 45,  duration: 15, category: 'Lipidograma' },
  { name: 'Não-HDL colesterol',                description: 'Colesterol total menos HDL',                          price: 40,  duration: 15, category: 'Lipidograma' },
  { name: 'Lipoproteína (a) — Lp(a)',          description: 'Fator de risco cardiovascular independente',          price: 90,  duration: 15, category: 'Lipidograma' },
  { name: 'Apolipoproteína A1',                description: 'Principal proteína do HDL',                          price: 70,  duration: 15, category: 'Lipidograma' },
  { name: 'Apolipoproteína B',                 description: 'Principal proteína do LDL e VLDL',                   price: 70,  duration: 15, category: 'Lipidograma' },

  // ── FUNÇÃO HEPÁTICA ────────────────────────────────────────────────────────
  { name: 'TGO (AST)',                         description: 'Aspartato aminotransferase',                          price: 30,  duration: 15, category: 'Hepatologia' },
  { name: 'TGP (ALT)',                         description: 'Alanina aminotransferase',                            price: 30,  duration: 15, category: 'Hepatologia' },
  { name: 'Gama GT (GGT)',                     description: 'Gama-glutamiltransferase — fígado, bile, álcool',    price: 30,  duration: 15, category: 'Hepatologia' },
  { name: 'Fosfatase alcalina',                description: 'Marcador hepático e ósseo',                          price: 30,  duration: 15, category: 'Hepatologia' },
  { name: 'Bilirrubinas total e frações',      description: 'Bilirrubina total, direta e indireta',               price: 35,  duration: 15, category: 'Hepatologia' },
  { name: 'Albumina sérica',                   description: 'Proteína hepática de síntese',                       price: 35,  duration: 15, category: 'Hepatologia' },
  { name: 'Proteínas totais e frações',        description: 'Albumina + globulina',                               price: 40,  duration: 15, category: 'Hepatologia' },
  { name: 'Hepatograma completo',              description: 'TGO, TGP, GGT, FA, Bilirrubinas, Albumina',          price: 140, duration: 15, category: 'Hepatologia' },

  // ── FUNÇÃO RENAL ───────────────────────────────────────────────────────────
  { name: 'Creatinina sérica',                 description: 'Marcador de filtração glomerular',                   price: 25,  duration: 15, category: 'Nefrologia' },
  { name: 'Ureia',                             description: 'Produto do catabolismo proteico',                    price: 25,  duration: 15, category: 'Nefrologia' },
  { name: 'Ácido úrico',                       description: 'Produto do metabolismo das purinas — gota e risco CV', price: 28, duration: 15, category: 'Nefrologia' },
  { name: 'Cistatina C',                       description: 'Marcador mais preciso de TFG que creatinina',        price: 110, duration: 15, category: 'Nefrologia' },
  { name: 'Microalbuminúria (urina spot)',      description: 'Detecção precoce de nefropatia diabética',          price: 55,  duration: 15, category: 'Nefrologia' },
  { name: 'Proteinúria de 24h',               description: 'Perda proteica urinária total em 24 horas',          price: 50,  duration: 15, category: 'Nefrologia' },
  { name: 'EAS — Urinálise completa',          description: 'Exame de urina tipo I com sedimento',               price: 30,  duration: 15, category: 'Nefrologia' },
  { name: 'Urocultura + antibiograma',         description: 'Cultura de urina com identificação e sensibilidade', price: 60,  duration: 15, category: 'Nefrologia' },

  // ── TIREOIDE ────────────────────────────────────────────────────────────────
  { name: 'TSH',                               description: 'Hormônio estimulante da tireoide',                   price: 45,  duration: 15, category: 'Tireoide' },
  { name: 'T4 livre',                          description: 'Tiroxina livre',                                     price: 50,  duration: 15, category: 'Tireoide' },
  { name: 'T3 livre',                          description: 'Triiodotironina livre',                              price: 50,  duration: 15, category: 'Tireoide' },
  { name: 'T4 total',                          description: 'Tiroxina total',                                     price: 45,  duration: 15, category: 'Tireoide' },
  { name: 'Anti-TPO (anticorpo antitireoperoxidase)', description: 'Tireoidite de Hashimoto e doença de Graves', price: 65,  duration: 15, category: 'Tireoide' },
  { name: 'Anti-tireoglobulina',               description: 'Autoanticorpo tireoidiano',                          price: 65,  duration: 15, category: 'Tireoide' },
  { name: 'Tireoglobulina',                    description: 'Marcador de função/recidiva de câncer de tireoide', price: 70,  duration: 15, category: 'Tireoide' },
  { name: 'Painel tireoidiano completo',       description: 'TSH + T4 livre + T3 livre + Anti-TPO',              price: 185, duration: 15, category: 'Tireoide' },

  // ── CARDIOVASCULAR E INFLAMAÇÃO ───────────────────────────────────────────
  { name: 'PCR ultrassensível (PCR-us)',        description: 'Proteína C-reativa de alta sensibilidade — risco CV', price: 70, duration: 15, category: 'Cardiovascular' },
  { name: 'PCR quantitativo',                  description: 'Proteína C-reativa — inflamação aguda',              price: 40,  duration: 15, category: 'Cardiovascular' },
  { name: 'Homocisteína',                      description: 'Aminoácido — fator de risco cardiovascular e neurológico', price: 85, duration: 15, category: 'Cardiovascular' },
  { name: 'Troponina I ou T',                  description: 'Marcador de lesão miocárdica',                      price: 90,  duration: 15, category: 'Cardiovascular' },
  { name: 'NT-proBNP',                         description: 'Marcador de insuficiência cardíaca',                price: 120, duration: 15, category: 'Cardiovascular' },
  { name: 'Interleucina-6 (IL-6)',             description: 'Citocina pró-inflamatória',                         price: 130, duration: 15, category: 'Cardiovascular' },

  // ── VITAMINAS E MINERAIS ──────────────────────────────────────────────────
  { name: 'Vitamina D (25-OH)',                description: '25-hidroxivitamina D — status de vitamina D',        price: 75,  duration: 15, category: 'Vitaminas' },
  { name: 'Vitamina B12',                      description: 'Cobalamina sérica',                                  price: 65,  duration: 15, category: 'Vitaminas' },
  { name: 'Ácido fólico (vitamina B9)',         description: 'Folato sérico ou eritrocitário',                    price: 65,  duration: 15, category: 'Vitaminas' },
  { name: 'Vitamina A (retinol)',               description: 'Retinol sérico',                                    price: 75,  duration: 15, category: 'Vitaminas' },
  { name: 'Vitamina E (tocoferol)',             description: 'Alfa-tocoferol sérico',                             price: 80,  duration: 15, category: 'Vitaminas' },
  { name: 'Zinco sérico',                      description: 'Mineral essencial — imunidade e metabolismo',       price: 55,  duration: 15, category: 'Minerais' },
  { name: 'Magnésio sérico',                   description: 'Mineral — função muscular, cardíaca e metabólica',  price: 45,  duration: 15, category: 'Minerais' },
  { name: 'Cálcio sérico',                     description: 'Cálcio total plasmático',                           price: 30,  duration: 15, category: 'Minerais' },
  { name: 'Fósforo sérico',                    description: 'Fosfato inorgânico sérico',                         price: 30,  duration: 15, category: 'Minerais' },
  { name: 'Ferro sérico + TIBC',               description: 'Ferro sérico e capacidade total de ligação ao ferro', price: 60, duration: 15, category: 'Minerais' },
  { name: 'Ferritina',                         description: 'Proteína de armazenamento de ferro — depósitos corporais', price: 55, duration: 15, category: 'Minerais' },
  { name: 'Saturação de transferrina',         description: 'Índice de saturação — diagnóstico de hemocromatose e anemia', price: 50, duration: 15, category: 'Minerais' },
  { name: 'Selênio',                           description: 'Mineral antioxidante',                              price: 95,  duration: 15, category: 'Minerais' },
  { name: 'Cobre sérico',                      description: 'Metal traço — metabolismo de ferro e antioxidante', price: 85,  duration: 15, category: 'Minerais' },

  // ── HORMÔNIOS ─────────────────────────────────────────────────────────────
  { name: 'Cortisol basal (matinal)',          description: 'Cortisol sérico às 8h — função adrenal',            price: 65,  duration: 15, category: 'Hormônios' },
  { name: 'Cortisol salivar noturno',          description: 'Detecção de hipercortisolismo — síndrome de Cushing', price: 90, duration: 15, category: 'Hormônios' },
  { name: 'DHEA-S',                            description: 'Dehidroepiandrosterona sulfato — produção adrenal', price: 65,  duration: 15, category: 'Hormônios' },
  { name: 'Testosterona total',                description: 'Androgênio principal masculino',                    price: 65,  duration: 15, category: 'Hormônios' },
  { name: 'Testosterona livre (cálculo)',      description: 'Testosterona biologicamente ativa',                 price: 90,  duration: 15, category: 'Hormônios' },
  { name: 'SHBG (globulina ligadora de hormônios sexuais)', description: 'Proteína carreadora de testosterona e estradiol', price: 75, duration: 15, category: 'Hormônios' },
  { name: 'Estradiol (E2)',                    description: 'Estrogênio principal feminino',                     price: 60,  duration: 15, category: 'Hormônios' },
  { name: 'Progesterona',                      description: 'Hormônio da fase lútea',                            price: 55,  duration: 15, category: 'Hormônios' },
  { name: 'FSH',                               description: 'Hormônio folículo-estimulante',                     price: 55,  duration: 15, category: 'Hormônios' },
  { name: 'LH',                                description: 'Hormônio luteinizante',                             price: 55,  duration: 15, category: 'Hormônios' },
  { name: 'Prolactina',                        description: 'Hormônio hipofisário',                              price: 55,  duration: 15, category: 'Hormônios' },
  { name: 'GH (hormônio do crescimento)',      description: 'Somatotrofina basal',                               price: 80,  duration: 15, category: 'Hormônios' },
  { name: 'IGF-1 (somatomedina C)',            description: 'Mediador do GH — avaliação do eixo GH/IGF-1',      price: 110, duration: 15, category: 'Hormônios' },
  { name: 'PTH (paratormônio)',                description: 'Regulação do cálcio e vitamina D',                  price: 85,  duration: 15, category: 'Hormônios' },
  { name: 'Insulina em jejum',                 description: 'Insulinemia basal',                                 price: 55,  duration: 15, category: 'Hormônios' },

  // ── MARCADORES TUMORAIS ───────────────────────────────────────────────────
  { name: 'PSA total',                         description: 'Antígeno prostático específico total',              price: 55,  duration: 15, category: 'Oncologia' },
  { name: 'PSA livre',                         description: 'PSA livre — relação livre/total para CA de próstata', price: 60, duration: 15, category: 'Oncologia' },
  { name: 'CEA (antígeno carcinoembrionário)', description: 'Marcador de neoplasias gastrointestinais',          price: 75,  duration: 15, category: 'Oncologia' },
  { name: 'CA 125',                            description: 'Marcador de CA de ovário',                          price: 80,  duration: 15, category: 'Oncologia' },
  { name: 'CA 19-9',                           description: 'Marcador de CA pancreático e gastrointestinal',     price: 80,  duration: 15, category: 'Oncologia' },
  { name: 'CA 15-3',                           description: 'Marcador de CA de mama',                           price: 80,  duration: 15, category: 'Oncologia' },
  { name: 'AFP (alfafetoproteína)',             description: 'Marcador de CA hepático e testicular',             price: 75,  duration: 15, category: 'Oncologia' },

  // ── AUTOIMUNIDADE ─────────────────────────────────────────────────────────
  { name: 'FAN (Fator antinuclear)',           description: 'Triagem de doenças autoimunes sistêmicas',          price: 75,  duration: 15, category: 'Autoimunidade' },
  { name: 'Fator reumatoide (FR)',             description: 'Artrite reumatoide e outras doenças reumáticas',   price: 45,  duration: 15, category: 'Autoimunidade' },
  { name: 'Anti-CCP',                          description: 'Anticorpos antipeptídeos citrulinados — AR específico', price: 105, duration: 15, category: 'Autoimunidade' },
  { name: 'Anti-DNA nativo (Anti-ds-DNA)',     description: 'Lúpus eritematoso sistêmico',                      price: 80,  duration: 15, category: 'Autoimunidade' },
  { name: 'Complemento C3 e C4',              description: 'Ativação do sistema complemento — doenças autoimunes', price: 70, duration: 15, category: 'Autoimunidade' },

  // ── INFECÇÕES / SOROLOGIAS ───────────────────────────────────────────────
  { name: 'HIV 1 e 2 (4ª geração)',           description: 'Antígeno p24 + anticorpos anti-HIV',                price: 60,  duration: 15, category: 'Sorologias' },
  { name: 'VDRL (sífilis)',                    description: 'Teste de rastreamento de sífilis',                  price: 30,  duration: 15, category: 'Sorologias' },
  { name: 'FTA-ABS (sífilis confirmatório)',   description: 'Teste treponêmico confirmatório',                   price: 55,  duration: 15, category: 'Sorologias' },
  { name: 'HBsAg (hepatite B)',                description: 'Antígeno de superfície do HBV',                    price: 40,  duration: 15, category: 'Sorologias' },
  { name: 'Anti-HBs (hepatite B)',             description: 'Anticorpo anti-HBs — imunidade vacinal',           price: 40,  duration: 15, category: 'Sorologias' },
  { name: 'Anti-HCV (hepatite C)',             description: 'Anticorpo anti-vírus hepatite C',                   price: 50,  duration: 15, category: 'Sorologias' },
  { name: 'Anti-HAV IgG (hepatite A)',         description: 'Imunidade à hepatite A',                           price: 55,  duration: 15, category: 'Sorologias' },
  { name: 'Toxoplasmose IgG + IgM',           description: 'Sorologias para Toxoplasma gondii',                 price: 70,  duration: 15, category: 'Sorologias' },
  { name: 'Rubéola IgG + IgM',                description: 'Sorologias para rubéola',                           price: 70,  duration: 15, category: 'Sorologias' },
  { name: 'CMV IgG + IgM',                    description: 'Citomegalovírus — imunidade e infecção ativa',      price: 70,  duration: 15, category: 'Sorologias' },
  { name: 'Herpes simplex 1 e 2 (IgG)',       description: 'HSV-1 e HSV-2 — anticorpos IgG',                   price: 75,  duration: 15, category: 'Sorologias' },
  { name: 'Chagas (sorologia)',                description: 'Doença de Chagas — doença de Chagas endêmica',      price: 65,  duration: 15, category: 'Sorologias' },

  // ── PACOTES PREVENTIVOS ────────────────────────────────────────────────────
  { name: 'Pacote check-up básico',            description: 'Hemograma + Glicemia + Colesterol + TGO + TGP + Creatinina + TSH + Urina tipo I', price: 220, duration: 15, category: 'Pacotes' },
  { name: 'Pacote cardiometabólico',           description: 'Hemograma + HbA1c + Lipidograma completo + PCR-us + Glicemia + Insulina + TGO + TGP + TSH', price: 380, duration: 15, category: 'Pacotes' },
  { name: 'Pacote hormonal feminino',          description: 'FSH + LH + Estradiol + Progesterona + Prolactina + TSH + T4 livre + DHEA-S',       price: 380, duration: 15, category: 'Pacotes' },
  { name: 'Pacote hormonal masculino',         description: 'Testosterona total e livre + SHBG + LH + FSH + Prolactina + PSA total + TSH',      price: 380, duration: 15, category: 'Pacotes' },
  { name: 'Pacote vitaminas e minerais',       description: 'Vitamina D + B12 + Ácido fólico + Ferritina + Magnésio + Zinco',                  price: 280, duration: 15, category: 'Pacotes' },
  { name: 'Pacote longevidade',                description: 'Hemograma + HbA1c + Lipidograma + IGF-1 + Vitamina D + B12 + PCR-us + Homocisteína + TSH + T4 livre + Testosterona/Estradiol', price: 680, duration: 15, category: 'Pacotes' },
]

async function main() {
  // Verifica exames já cadastrados para evitar duplicatas
  const existing = await prisma.examCatalog.findMany({ select: { name: true } })
  const existingNames = new Set(existing.map(e => e.name))

  let inserted = 0
  let skipped  = 0

  for (const exam of exames) {
    if (existingNames.has(exam.name)) {
      skipped++
      continue
    }
    await prisma.examCatalog.create({
      data: {
        name:        exam.name,
        description: exam.description,
        price:       exam.price,
        duration:    exam.duration,
        isActive:    true,
      },
    })
    inserted++
  }

  console.log(`✅ ${inserted} exames inseridos | ${skipped} já existiam`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
