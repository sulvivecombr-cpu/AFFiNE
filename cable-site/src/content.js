'use strict';

/**
 * Conteúdo inicial do site institucional do Cable.
 *
 * Regra de ouro deste arquivo: nenhum dado fictício. Identidade empresarial,
 * preços, links de loja e endereço do aplicativo nascem vazios e ficam
 * pendentes no painel administrativo até serem cadastrados de verdade.
 */

const LEGAL_SLUGS = [
  'termos',
  'privacidade',
  'cookies',
  'ia',
  'assinatura',
  'uso-aceitavel',
  'seguranca',
  'acessibilidade',
  'aviso-educacional',
  'titulares',
];

const legalDocs = [
  {
    slug: 'termos',
    title: 'Termos de Uso',
    summary:
      'Regras de utilização da plataforma Cable, cadastro, responsabilidades, propriedade intelectual e atendimento.',
    version: '1.0',
    updatedAt: '2026-11-18',
    reviewStatus: 'pending',
    blocks: [
      {
        h: '1. Identificação do fornecedor',
        p: [
          'O Cable é operado por {{legalName}}, nome comercial {{tradeName}}, inscrita no CNPJ {{cnpj}}, com endereço em {{address}}.',
          'Canal de atendimento oficial: {{supportChannel}}. E-mail: {{email}}.',
        ],
      },
      {
        h: '2. Descrição do serviço',
        p: [
          'O Cable é uma plataforma de software como serviço (SaaS) voltada à preparação para concursos públicos. A plataforma auxilia o usuário a organizar o estudo do edital, planejar a rotina, registrar sessões de estudo, resolver questões, acompanhar o desempenho e receber recomendações geradas com apoio de inteligência artificial.',
          'O Cable é uma ferramenta de apoio educacional. Não é órgão público, não representa bancas organizadoras e não possui vínculo oficial com os órgãos cujos concursos o usuário acompanha.',
        ],
      },
      {
        h: '3. Aceitação',
        p: [
          'Ao criar uma conta ou utilizar a plataforma, o usuário declara ter lido e concordado com estes Termos de Uso e com a Política de Privacidade. O uso é permitido apenas a pessoas com capacidade civil para contratar; menores de idade devem utilizá-la com assistência do responsável legal.',
        ],
      },
      {
        h: '4. Cadastro e conta',
        p: [
          'O usuário deve fornecer informações verdadeiras, completas e atualizadas no cadastro, mantendo a confidencialidade de suas credenciais.',
          'A conta é pessoal e intransferível. O compartilhamento de credenciais e o uso simultâneo por terceiros podem gerar suspensão, conforme a Política de Uso Aceitável.',
        ],
      },
      {
        h: '5. Responsabilidades do usuário',
        p: [
          'O usuário é responsável pelo conteúdo que envia à plataforma, pela veracidade das informações de cadastro e pelo uso adequado dos recursos.',
          'O usuário compromete-se a não utilizar a plataforma para fins ilícitos, para violar direitos de terceiros ou para tentar acessar áreas restritas, dados de outros usuários ou a infraestrutura do serviço.',
        ],
      },
      {
        h: '6. Segurança da conta',
        p: [
          'Recomenda-se senha exclusiva e forte, além da ativação de autenticação em dois fatores quando disponível. O usuário deve comunicar imediatamente qualquer suspeita de acesso não autorizado pelo canal de atendimento.',
        ],
      },
      {
        h: '7. Propriedade intelectual',
        p: [
          'O software, a marca Cable, a identidade visual, os textos institucionais e os elementos de interface são protegidos por direitos de propriedade intelectual e não podem ser copiados, modificados, distribuídos ou explorados comercialmente sem autorização.',
          'O conteúdo enviado pelo usuário permanece de sua titularidade. O usuário concede à plataforma licença limitada, não exclusiva e revogável para armazenar e processar esse conteúdo com a finalidade de prestar o serviço.',
        ],
      },
      {
        h: '8. Conteúdo enviado pelo usuário',
        p: [
          'O usuário declara possuir os direitos necessários sobre materiais que envia (resumos, anotações, arquivos de edital e afins) e responde por eventual violação de direitos autorais de terceiros.',
        ],
      },
      {
        h: '9. Conteúdo gerado por inteligência artificial',
        p: [
          'As respostas e recomendações geradas por inteligência artificial podem conter imprecisões. O conteúdo gerado tem finalidade de assistência educacional e deve ser conferido pelo usuário nas fontes oficiais do concurso.',
          'O Cable não garante aprovação, classificação ou qualquer resultado em concurso público. As condições de tratamento de dados nas funcionalidades de IA estão descritas na Política de Inteligência Artificial.',
        ],
      },
      {
        h: '10. Serviços de terceiros',
        p: [
          'A plataforma pode depender de fornecedores de infraestrutura, autenticação, envio de e-mail e processamento de inteligência artificial. A indisponibilidade pontual desses fornecedores pode afetar funcionalidades específicas.',
        ],
      },
      {
        h: '11. Limitações técnicas e disponibilidade',
        p: [
          'O serviço é fornecido no estado em que se encontra, com esforço de disponibilidade contínua. Podem ocorrer manutenções programadas, atualizações e interrupções por motivos técnicos ou de força maior.',
          'Requisitos mínimos de dispositivo, navegador e conexão são informados na página Baixar Cable e podem ser atualizados conforme a evolução do produto.',
        ],
      },
      {
        h: '12. Suspensão e encerramento',
        p: [
          'A conta pode ser suspensa ou encerrada em caso de violação destes Termos, da Política de Uso Aceitável, de determinação legal ou de uso que comprometa a segurança da plataforma.',
          'O usuário pode encerrar a conta a qualquer momento pelos canais de atendimento, observadas as obrigações de retenção legal descritas na Política de Privacidade.',
        ],
      },
      {
        h: '13. Limitação de responsabilidade',
        p: [
          'Na máxima extensão permitida pela legislação aplicável, a plataforma não responde por lucros cessantes, perda de oportunidade, reprovação em certame ou decisões tomadas exclusivamente com base em conteúdo gerado por inteligência artificial.',
          'Nenhuma cláusula destes Termos afasta direitos irrenunciáveis do consumidor previstos no Código de Defesa do Consumidor.',
        ],
      },
      {
        h: '14. Atendimento',
        p: [
          'O atendimento ocorre pelos canais oficiais publicados nesta página e na Central de Ajuda. Solicitações são registradas com protocolo e respondidas no prazo informado no momento do registro.',
        ],
      },
      {
        h: '15. Atualizações dos termos',
        p: [
          'Estes Termos podem ser atualizados para refletir mudanças no produto ou na legislação. Alterações relevantes serão comunicadas com antecedência razoável pelos canais oficiais, mantendo-se o histórico de versões.',
        ],
      },
      {
        h: '16. Foro e legislação aplicável',
        p: [
          'Aplica-se a legislação brasileira. Eventuais controvérsias serão resolvidas no foro do domicílio do consumidor, quando assim exigir a legislação consumerista.',
        ],
      },
    ],
  },
  {
    slug: 'privacidade',
    title: 'Política de Privacidade (LGPD)',
    summary:
      'Quais dados o Cable trata, com quais finalidades e bases legais, como são compartilhados, retidos e como exercer seus direitos.',
    version: '1.0',
    updatedAt: '2026-11-18',
    reviewStatus: 'pending',
    blocks: [
      {
        h: '1. Controlador e contato',
        p: [
          'Controlador dos dados pessoais: {{legalName}}, CNPJ {{cnpj}}, endereço {{address}}.',
          'Encarregado pelo tratamento de dados (DPO): {{dpo}}. Canal de privacidade: {{email}}.',
        ],
      },
      {
        h: '2. Dados coletados',
        p: [
          'Dados de cadastro: nome, e-mail, senha (armazenada de forma criptografada) e, quando informado pelo usuário, foto de perfil e preferências de estudo.',
          'Dados de uso da plataforma: concursos acompanhados, editais importados, disciplinas, planejamento, sessões de estudo, questões respondidas, erros registrados, revisões e anotações.',
          'Dados técnicos e de navegação: endereço IP, tipo de dispositivo, navegador, sistema operacional, data e hora de acesso, identificadores de sessão e registros de erro.',
          'Dados de atendimento: conteúdo das mensagens enviadas pelos formulários de contato, suporte e privacidade, e o histórico de respostas.',
        ],
      },
      {
        h: '3. Finalidades e bases legais',
        p: [
          'Execução de contrato (art. 7º, V, da LGPD): criar e manter a conta, entregar as funcionalidades contratadas, sincronizar o conteúdo do usuário e prestar suporte.',
          'Cumprimento de obrigação legal ou regulatória (art. 7º, II): guarda de registros de acesso e atendimento a determinações de autoridades competentes.',
          'Legítimo interesse (art. 7º, IX): segurança da informação, prevenção a fraudes, melhoria do produto e diagnósticos técnicos, sempre com avaliação de impacto e respeito às expectativas do titular.',
          'Consentimento (art. 7º, I): comunicações de marketing, newsletter e cookies não essenciais. O consentimento pode ser revogado a qualquer momento nas preferências de cookies ou pelo canal de privacidade.',
        ],
      },
      {
        h: '4. Compartilhamento e fornecedores',
        p: [
          'Os dados podem ser compartilhados com fornecedores estritamente necessários à operação do serviço, como hospedagem e infraestrutura em nuvem, envio de e-mail transacional, ferramentas de monitoramento de erros e provedores de modelos de inteligência artificial.',
          'A lista nominal de subprocessadores, com finalidade e país de tratamento, é mantida no painel administrativo do site e será publicada nesta política após a contratação efetiva de cada fornecedor. Nenhum fornecedor é listado aqui antes de estar de fato contratado.',
        ],
      },
      {
        h: '5. Transferência internacional',
        p: [
          'Caso o serviço utilize fornecedores com servidores fora do Brasil, a transferência observará os arts. 33 a 36 da LGPD, com cláusulas contratuais adequadas e avaliação de nível de proteção. A existência e a extensão dessa transferência serão informadas quando os fornecedores forem definidos.',
        ],
      },
      {
        h: '6. Retenção',
        p: [
          'Dados de conta são mantidos enquanto a conta estiver ativa e por prazo adicional necessário ao cumprimento de obrigações legais.',
          'Registros de acesso são mantidos pelo prazo mínimo previsto na legislação aplicável. Registros de atendimento e de consentimento são mantidos para comprovação de conformidade.',
          'Após os prazos aplicáveis, os dados são eliminados ou anonimizados de forma irreversível.',
        ],
      },
      {
        h: '7. Segurança',
        p: [
          'Adotam-se medidas técnicas e administrativas como controle de acesso por perfil, criptografia em trânsito, criptografia de senhas, registro de auditoria, monitoramento de falhas e princípio do menor privilégio.',
          'Em caso de incidente de segurança relevante, os titulares e a ANPD serão comunicados nos termos da legislação.',
        ],
      },
      {
        h: '8. Direitos dos titulares',
        p: [
          'O titular pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários, portabilidade, informação sobre compartilhamento, revogação de consentimento e oposição a tratamentos específicos.',
          'As solicitações podem ser feitas pelo formulário de solicitações de titulares disponível neste site, que gera protocolo de acompanhamento.',
        ],
      },
      {
        h: '9. Dados em funcionalidades de inteligência artificial',
        p: [
          'Conteúdos enviados às funcionalidades de inteligência artificial (como dúvidas, trechos de materiais e histórico de desempenho) são processados para gerar respostas e recomendações dentro da conta do usuário.',
          'Informações pessoais não são utilizadas para treinamento de modelos externos sem base legal, transparência e autorização, ou outra hipótese juridicamente válida. Detalhes em Política de Inteligência Artificial.',
        ],
      },
      {
        h: '10. Cookies',
        p: [
          'Cookies essenciais são necessários ao funcionamento do site. Cookies de preferência, estatística e marketing dependem de consentimento e podem ser gerenciados a qualquer momento na página Preferências de Cookies.',
        ],
      },
      {
        h: '11. Crianças e adolescentes',
        p: [
          'O serviço é destinado a maiores de 18 anos ou a adolescentes com supervisão de responsável legal, observado o melhor interesse da criança e do adolescente.',
        ],
      },
      {
        h: '12. Alterações',
        p: [
          'Esta política pode ser atualizada. Cada versão é datada e mantida no histórico público de versões deste documento.',
        ],
      },
    ],
  },
  {
    slug: 'cookies',
    title: 'Política de Cookies',
    summary:
      'Categorias de cookies usados pelo site, finalidade de cada uma e como aceitar, recusar ou revogar o consentimento.',
    version: '1.0',
    updatedAt: '2026-11-18',
    reviewStatus: 'pending',
    blocks: [
      {
        h: '1. O que são cookies',
        p: [
          'Cookies e tecnologias semelhantes (armazenamento local, pixels e identificadores) são pequenos registros gravados no dispositivo do visitante para permitir o funcionamento do site e, quando autorizado, medir audiência e personalizar comunicação.',
        ],
      },
      {
        h: '2. Categorias',
        p: [
          'Essenciais: necessários para segurança, sessão, preferências de idioma e registro do próprio consentimento. Não podem ser desativados sem prejuízo do funcionamento do site.',
          'Preferências: memorizam escolhas de interface, como tema e categorias de conteúdo abertas.',
          'Estatística: medem audiência e desempenho das páginas de forma agregada.',
          'Marketing: permitem mensurar campanhas e apresentar comunicações relevantes.',
        ],
      },
      {
        h: '3. Consentimento',
        p: [
          'Cookies não essenciais só são ativados após manifestação válida do visitante. O banner permite aceitar todos, rejeitar não essenciais, personalizar por categoria, salvar preferências e revogar a escolha.',
          'Cada escolha é registrada com data, hora, categorias autorizadas e versão desta política. O histórico fica disponível ao visitante neste site e no painel administrativo.',
        ],
      },
      {
        h: '4. Como gerenciar',
        p: [
          'As preferências podem ser alteradas em Preferências de Cookies, no rodapé de todas as páginas. O bloqueio direto no navegador também é possível, mas pode afetar funcionalidades.',
        ],
      },
      {
        h: '5. Cookies de terceiros',
        p: [
          'Ferramentas de análise, publicidade e atendimento só serão incorporadas quando efetivamente contratadas e configuradas no painel administrativo, respeitando o consentimento do visitante.',
        ],
      },
      {
        h: '6. Validade',
        p: [
          'O consentimento é revalidado periodicamente e sempre que esta política for atualizada de forma relevante.',
        ],
      },
    ],
  },
  {
    slug: 'ia',
    title: 'Política de Inteligência Artificial',
    summary:
      'O que é o Cable AI, quais dados processa, quais são seus limites e por que o conteúdo gerado exige conferência nas fontes oficiais.',
    version: '1.0',
    updatedAt: '2026-11-18',
    reviewStatus: 'pending',
    blocks: [
      {
        h: '1. O que é o Cable AI',
        p: [
          'O Cable AI é o conjunto de recursos de assistência inteligente da plataforma. Ele analisa o progresso registrado pelo usuário, identifica dificuldades, sugere prioridades de estudo, apoia a organização do planejamento e auxilia na elaboração de revisões.',
        ],
      },
      {
        h: '2. Como funciona',
        p: [
          'As recomendações são produzidas a partir dos dados que o próprio usuário registra na plataforma — concursos, disciplinas, sessões de estudo, acertos e erros, revisões agendadas — combinados com modelos de linguagem de fornecedores especializados.',
          'O resultado é um texto ou sugestão gerada por modelo estatístico, não uma decisão automática sobre a vida do usuário.',
        ],
      },
      {
        h: '3. Finalidade',
        p: [
          'A finalidade é educacional e de produtividade: apoiar a organização, a revisão e a aprendizagem. O Cable AI não substitui professor, orientação pedagógica, edital oficial ou decisão pessoal.',
        ],
      },
      {
        h: '4. Informações processadas',
        p: [
          'Podem ser processados textos e dados de estudo fornecidos pelo usuário, histórico de desempenho, preferências de planejamento e mensagens enviadas ao assistente. Dados de cadastro sensíveis não são necessários para gerar recomendações.',
        ],
      },
      {
        h: '5. Limitações e possibilidade de erros',
        p: [
          'Modelos de linguagem podem produzir informações incorretas, desatualizadas ou incompletas, inclusive sobre datas, exigências e conteúdo de editais. Toda informação sobre concurso deve ser conferida no documento oficial publicado pela banca ou pelo órgão.',
          'O Cable não garante aprovação, classificação, nota ou qualquer resultado em concurso público.',
        ],
      },
      {
        h: '6. Revisão das recomendações',
        p: [
          'As recomendações são sugestões. A decisão sobre como estudar é sempre do usuário, que deve avaliar o contexto, o edital e suas condições pessoais.',
        ],
      },
      {
        h: '7. Fontes',
        p: [
          'As respostas podem se basear em dados da própria conta e em conhecimento geral dos modelos. Quando houver indicação de fonte, ela deve ser conferida no endereço original.',
        ],
      },
      {
        h: '8. Dados pessoais',
        p: [
          'O tratamento de dados nas funcionalidades de IA observa a Política de Privacidade. Informações pessoais não são utilizadas para treinamento de modelos externos sem base legal, transparência e autorização.',
        ],
      },
      {
        h: '9. Responsabilidades do usuário',
        p: [
          'O usuário deve evitar inserir dados sensíveis ou de terceiros sem necessidade e não deve tratar as respostas como informação oficial de concurso.',
        ],
      },
      {
        h: '10. Distinção entre informação oficial e conteúdo gerado',
        p: [
          'Conteúdo gerado por IA é identificado como tal na interface. Informações oficiais são as publicadas pelos órgãos e bancas em seus canais próprios.',
        ],
      },
    ],
  },
  {
    slug: 'assinatura',
    title: 'Política de Assinatura, Cancelamento e Reembolso',
    summary:
      'Como funcionarão contratação, renovação, cancelamento e reembolso quando os planos comerciais forem ativados.',
    version: '1.0',
    updatedAt: '2026-11-18',
    reviewStatus: 'pending',
    blocks: [
      {
        h: '1. Situação atual',
        p: [
          'Os planos comerciais do Cable ainda não estão em contratação online. Enquanto não houver preço publicado e meio de pagamento ativo, não há cobrança, assinatura, renovação nem reembolso a processar.',
          'Esta política descreve as condições que serão aplicadas a partir da ativação comercial e permanece sujeita a revisão jurídica antes da publicação definitiva.',
        ],
      },
      {
        h: '2. Contratação',
        p: [
          'A contratação ocorrerá por meio de checkout oficial, com apresentação de preço total, periodicidade, recursos incluídos, limites e condições de cancelamento antes da confirmação.',
        ],
      },
      {
        h: '3. Recorrência e renovação',
        p: [
          'Planos recorrentes serão renovados automaticamente pelo período contratado, com aviso prévio e possibilidade de cancelamento antes da renovação.',
        ],
      },
      {
        h: '4. Cobrança e inadimplência',
        p: [
          'O não pagamento poderá suspender o acesso às funcionalidades pagas após tentativas de cobrança e comunicação ao usuário, preservando o acesso aos dados para exportação por prazo razoável.',
        ],
      },
      {
        h: '5. Cancelamento',
        p: [
          'O cancelamento poderá ser solicitado a qualquer momento pelos canais oficiais, sem multa, permanecendo o acesso até o fim do período já pago.',
        ],
      },
      {
        h: '6. Direito de arrependimento',
        p: [
          'Nas contratações realizadas fora do estabelecimento comercial, o consumidor poderá exercer o direito de arrependimento no prazo legal de 7 (sete) dias corridos a contar da contratação, nos termos do art. 49 do Código de Defesa do Consumidor.',
        ],
      },
      {
        h: '7. Reembolso',
        p: [
          'Reembolsos observarão o Código de Defesa do Consumidor e as condições informadas no checkout. Cobranças indevidas serão devolvidas integralmente.',
        ],
      },
      {
        h: '8. Alteração de planos',
        p: [
          'Upgrades e downgrades serão aplicados a partir do próximo ciclo, com proporcionalidade informada antes da confirmação.',
        ],
      },
      {
        h: '9. Atendimento',
        p: [
          'Solicitações comerciais são registradas com protocolo pelo canal de atendimento oficial: {{supportChannel}}.',
        ],
      },
    ],
  },
  {
    slug: 'uso-aceitavel',
    title: 'Política de Uso Aceitável',
    summary:
      'O que é permitido, o que é proibido e como o Cable trata violações de uso da plataforma e das APIs.',
    version: '1.0',
    updatedAt: '2026-11-18',
    reviewStatus: 'pending',
    blocks: [
      {
        h: '1. Uso permitido',
        p: [
          'A plataforma deve ser usada para fins pessoais e legítimos de preparação para concursos públicos, respeitando a lei, direitos de terceiros e estes termos.',
        ],
      },
      {
        h: '2. Condutas proibidas',
        p: [
          'Fraude, falsidade ideológica, criação de contas com dados de terceiros e uso de mecanismos para burlar limites de plano.',
          'Abuso de APIs: requisições automatizadas em volume anormal, scraping, engenharia reversa de endpoints e tentativas de contornar autenticação ou limites de uso.',
          'Tentativas de invasão, varredura de vulnerabilidades sem autorização escrita, exploração de falhas e interferência na infraestrutura.',
          'Compartilhamento indevido de contas, revenda de acesso e uso simultâneo por terceiros não autorizados.',
          'Violação de direitos autorais, upload de material de terceiros sem autorização, conteúdo ilícito, ofensivo ou que viole direitos da personalidade.',
          'Manipulação de sistemas de recomendação, de métricas de desempenho ou de qualquer mecanismo de integridade da plataforma.',
        ],
      },
      {
        h: '3. Medidas de prevenção e tratamento',
        p: [
          'O Cable utiliza limites de requisição, validação de entrada, monitoramento de abuso e registros de auditoria.',
          'Violações podem gerar advertência, limitação temporária, suspensão ou encerramento da conta, conforme gravidade, com comunicação ao usuário e possibilidade de contraditório pelo canal de atendimento.',
          'Casos que envolvam crime serão encaminhados às autoridades competentes.',
        ],
      },
      {
        h: '4. Denúncias',
        p: [
          'Abusos podem ser denunciados pelo formulário de contato, categoria Suporte ou Privacidade, conforme o caso.',
        ],
      },
    ],
  },
  {
    slug: 'seguranca',
    title: 'Política de Segurança',
    summary:
      'Princípios de proteção da plataforma: controle de acesso, criptografia, monitoramento, resposta a incidentes e gestão de vulnerabilidades.',
    version: '1.0',
    updatedAt: '2026-11-18',
    reviewStatus: 'pending',
    blocks: [
      {
        h: '1. Controle de acesso',
        p: [
          'Acesso a ambientes administrativos é restrito por função (RBAC) e registrado em trilha de auditoria. Aplica-se o princípio do menor privilégio.',
        ],
      },
      {
        h: '2. Proteção de contas',
        p: [
          'Senhas são armazenadas com algoritmo de derivação de chave e salt individual. Sessões usam cookies HttpOnly e são invalidadas no logout e na troca de senha.',
        ],
      },
      {
        h: '3. Criptografia',
        p: [
          'O tráfego entre navegador e servidores deve ocorrer sobre HTTPS em produção. Dados sensíveis em repouso são protegidos conforme a capacidade do fornecedor de infraestrutura.',
        ],
      },
      {
        h: '4. Monitoramento e prevenção',
        p: [
          'Registros de acesso, erros e eventos administrativos são monitorados para identificar comportamento anômalo. Limites de requisição e validação de entrada reduzem risco de abuso.',
        ],
      },
      {
        h: '5. Resposta a incidentes',
        p: [
          'Incidentes são classificados por severidade, contidos e documentados. Quando houver risco relevante aos titulares, a comunicação observará a LGPD e os prazos da ANPD.',
        ],
      },
      {
        h: '6. Gestão de vulnerabilidades',
        p: [
          'Dependências são atualizadas periodicamente e revisadas quanto a vulnerabilidades conhecidas. Correções críticas são priorizadas.',
        ],
      },
      {
        h: '7. Transparência',
        p: [
          'Detalhes de infraestrutura que possam comprometer a segurança não são divulgados. O Cable não anuncia certificações que ainda não possui.',
        ],
      },
    ],
  },
  {
    slug: 'acessibilidade',
    title: 'Declaração de Acessibilidade',
    summary:
      'Compromisso com WCAG 2.2 nível AA, recursos implementados neste site e limitações conhecidas.',
    version: '1.0',
    updatedAt: '2026-11-18',
    reviewStatus: 'pending',
    blocks: [
      {
        h: '1. Compromisso',
        p: [
          'O site institucional do Cable busca conformidade com as Diretrizes de Acessibilidade para Conteúdo Web (WCAG) 2.2, nível AA, e com boas práticas de acessibilidade digital.',
        ],
      },
      {
        h: '2. Recursos implementados',
        p: [
          'Estrutura semântica com landmarks, títulos hierárquicos, link de salto para o conteúdo principal, foco visível, navegação completa por teclado, textos alternativos em imagens informativas, formulários com rótulos associados e mensagens de erro descritivas, contraste mínimo de 4,5:1 para texto e respeito à preferência de movimento reduzido.',
        ],
      },
      {
        h: '3. Limitações conhecidas',
        p: [
          'Conteúdos em PDF de terceiros (editais e documentos oficiais) podem não ser acessíveis, pois são publicados pelos órgãos responsáveis.',
          'Materiais produzidos por usuários dentro do aplicativo podem não seguir integralmente as diretrizes.',
        ],
      },
      {
        h: '4. Contato',
        p: [
          'Encontrou uma barreira de acessibilidade? Registre pelo formulário de contato com assunto Acessibilidade ou pelo canal {{supportChannel}}. O retorno é registrado com protocolo.',
        ],
      },
      {
        h: '5. Avaliação',
        p: [
          'Este site é revisado periodicamente com testes manuais de teclado, leitor de tela e verificação de contraste. A data da última revisão é exibida no topo deste documento.',
        ],
      },
    ],
  },
  {
    slug: 'aviso-educacional',
    title: 'Aviso Educacional e Informacional',
    summary:
      'O Cable é ferramenta de apoio à preparação, sem vínculo com órgãos públicos ou bancas organizadoras.',
    version: '1.0',
    updatedAt: '2026-11-18',
    reviewStatus: 'pending',
    blocks: [
      {
        h: '1. Natureza do serviço',
        p: [
          'O Cable é uma ferramenta tecnológica de apoio à preparação para concursos públicos. Seu objetivo é organizar estudos, acompanhar desempenho e auxiliar a aprendizagem.',
        ],
      },
      {
        h: '2. Sem vínculo oficial',
        p: [
          'O Cable não é órgão público, não representa bancas organizadoras e não possui vínculo oficial, patrocínio ou endosso dos órgãos cujos concursos o usuário acompanha.',
        ],
      },
      {
        h: '3. Conferência em fontes oficiais',
        p: [
          'Informações sobre editais, datas, requisitos, vagas, salários e etapas devem ser conferidas nos documentos oficiais publicados pelo órgão ou pela banca organizadora. O conteúdo da plataforma é de apoio e pode conter imprecisões.',
        ],
      },
      {
        h: '4. Resultado',
        p: [
          'A aprovação depende de fatores que não podem ser controlados pela plataforma, como desempenho individual, concorrência, critérios da banca e condições do certame. O Cable não garante aprovação, classificação ou nota.',
        ],
      },
      {
        h: '5. Conteúdo de terceiros',
        p: [
          'Materiais de terceiros exibidos ou referenciados pertencem a seus autores e são de responsabilidade destes.',
        ],
      },
    ],
  },
  {
    slug: 'titulares',
    title: 'Solicitações de Titulares de Dados',
    summary:
      'Como solicitar acesso, correção, exclusão, exportação, revogação de consentimento e informações sobre tratamento de dados.',
    version: '1.0',
    updatedAt: '2026-11-18',
    reviewStatus: 'pending',
    blocks: [
      {
        h: '1. Como solicitar',
        p: [
          'Utilize o formulário de solicitações de titulares disponível neste site. Informe apenas os dados necessários para identificar sua solicitação: nome, e-mail de contato e o tipo de pedido. Não é obrigatório informar CPF.',
        ],
      },
      {
        h: '2. Tipos de solicitação',
        p: [
          'Confirmação de tratamento, acesso aos dados, correção de dados incompletos ou desatualizados, anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos, portabilidade, informação sobre compartilhamento, revogação de consentimento, oposição a tratamento e informações gerais sobre tratamento.',
        ],
      },
      {
        h: '3. Protocolo e acompanhamento',
        p: [
          'Cada solicitação gera um número de protocolo exibido na confirmação e enviado ao e-mail informado. O acompanhamento pode ser feito pelo canal de atendimento {{supportChannel}} informando o protocolo.',
        ],
      },
      {
        h: '4. Prazos',
        p: [
          'As solicitações são respondidas em prazo razoável e nos limites previstos na LGPD, podendo ser solicitadas informações adicionais para confirmar a identidade do requerente e evitar acesso indevido a dados de terceiros.',
        ],
      },
      {
        h: '5. Encarregado',
        p: [
          'Encarregado pelo tratamento de dados (DPO): {{dpo}}. Canal de privacidade: {{email}}.',
        ],
      },
    ],
  },
];

const features = [
  {
    key: 'dashboard',
    name: 'Dashboard',
    summary: 'Visão consolidada da sua preparação: tempo estudado, metas do período e evolução por disciplina.',
    icon: 'grid',
  },
  {
    key: 'concursos',
    name: 'Concursos',
    summary: 'Cadastre os concursos que você acompanha e mantenha cada preparação separada e organizada.',
    icon: 'flag',
  },
  {
    key: 'editais',
    name: 'Editais',
    summary: 'Estruture o conteúdo programático do edital em tópicos estudáveis e acompanhe a cobertura.',
    icon: 'file',
  },
  {
    key: 'disciplinas',
    name: 'Disciplinas',
    summary: 'Organize disciplinas, pesos e prioridades de acordo com o seu edital e sua dificuldade.',
    icon: 'book',
  },
  {
    key: 'planejamento',
    name: 'Planejamento',
    summary: 'Monte a rotina de estudos e ajuste o plano conforme o tempo real disponível na semana.',
    icon: 'calendar',
  },
  {
    key: 'questoes',
    name: 'Questões',
    summary: 'Resolva questões, registre acertos e erros e acompanhe o desempenho por tópico.',
    icon: 'check',
  },
  {
    key: 'caderno-erros',
    name: 'Caderno de erros',
    summary: 'Concentre as questões erradas e os motivos do erro para transformar falha em revisão dirigida.',
    icon: 'alert',
  },
  {
    key: 'revisoes',
    name: 'Revisões',
    summary: 'Agende revisões dos conteúdos e mantenha o que já foi estudado disponível na memória.',
    icon: 'repeat',
  },
  {
    key: 'simulados',
    name: 'Simulados',
    summary: 'Registre simulados completos e compare o resultado com a evolução do seu histórico.',
    icon: 'timer',
  },
  {
    key: 'materiais',
    name: 'Materiais',
    summary: 'Guarde resumos, anotações e arquivos de estudo vinculados às disciplinas certas.',
    icon: 'folder',
  },
  {
    key: 'analytics',
    name: 'Analytics',
    summary: 'Analise produtividade, cobertura do edital e desempenho por disciplina ao longo do tempo.',
    icon: 'chart',
  },
  {
    key: 'cable-ai',
    name: 'Cable AI',
    summary: 'Assistência inteligente para analisar progresso, identificar dificuldades e sugerir prioridades.',
    icon: 'spark',
  },
  {
    key: 'integracoes',
    name: 'Integrações',
    summary: 'Espaço para conectar o Cable aos serviços usados na sua rotina de estudos.',
    icon: 'plug',
    status: 'em-desenvolvimento',
  },
];

const faqs = [
  {
    q: 'O que é o Cable?',
    a: 'O Cable é uma plataforma SaaS de preparação para concursos públicos. Ela organiza concursos, editais, disciplinas e planejamento, registra sessões de estudo e questões, acompanha o desempenho e usa inteligência artificial para apoiar revisões e prioridades. É uma ferramenta de apoio: não substitui o edital oficial nem garante resultado.',
    category: 'Geral',
  },
  {
    q: 'Quem pode utilizar o Cable?',
    a: 'Qualquer candidato a concurso público: carreiras policiais, tribunais, áreas administrativas, concursos federais, estaduais e municipais. O serviço é destinado a maiores de 18 anos ou a adolescentes com supervisão de responsável legal.',
    category: 'Geral',
  },
  {
    q: 'O Cable funciona pelo celular?',
    a: 'Sim. O Cable é uma aplicação web responsiva e funciona em navegadores modernos de celular, tablet e computador. Em dispositivos compatíveis, é possível instalar a experiência como aplicativo pela opção de adicionar à tela de início do navegador.',
    category: 'Aplicativo',
  },
  {
    q: 'É necessário instalar?',
    a: 'Não. O acesso principal é pelo navegador. A instalação é opcional e depende da compatibilidade do dispositivo e da versão publicada — veja a página Baixar Cable para instruções.',
    category: 'Aplicativo',
  },
  {
    q: 'Como cadastrar meu concurso?',
    a: 'Dentro da plataforma, cadastre o concurso que você acompanha e vincule o edital. A partir do conteúdo programático você estrutura disciplinas e tópicos, que alimentam o planejamento e o acompanhamento de desempenho.',
    category: 'Concursos',
  },
  {
    q: 'Como funciona a inteligência artificial?',
    a: 'O Cable AI analisa os dados que você registra — sessões de estudo, acertos e erros, revisões — e gera sugestões de prioridade, organização e revisão. As respostas podem conter imprecisões e devem ser conferidas nas fontes oficiais. O Cable não garante aprovação.',
    category: 'Cable AI',
  },
  {
    q: 'Posso acompanhar mais de um concurso?',
    a: 'Sim. Cada concurso é tratado como uma preparação própria, com edital, disciplinas e planejamento separados.',
    category: 'Concursos',
  },
  {
    q: 'Como funciona o planejamento?',
    a: 'Você define a disponibilidade semanal e as prioridades por disciplina. O plano distribui os conteúdos e registra o que foi cumprido, permitindo ajustes conforme a rotina real.',
    category: 'Estudos',
  },
  {
    q: 'O Cable possui versão gratuita?',
    a: 'A estrutura comercial está em definição e ainda não há planos com preço publicado. Os planos serão apresentados nesta página quando forem aprovados, com recursos, limites e condições completas.',
    category: 'Planos',
  },
  {
    q: 'Como funcionam os planos?',
    a: 'Os planos serão configuráveis e apresentarão valor, periodicidade, recursos, limites e condições. Nenhuma cobrança é realizada enquanto não houver preço publicado e meio de pagamento ativo.',
    category: 'Planos',
  },
  {
    q: 'Como cancelar uma assinatura?',
    a: 'Ainda não há assinaturas ativas. Quando a contratação online for ativada, o cancelamento poderá ser solicitado a qualquer momento pelos canais oficiais, sem multa, com acesso mantido até o fim do período pago, conforme a Política de Assinatura, Cancelamento e Reembolso.',
    category: 'Pagamentos',
  },
  {
    q: 'Como solicitar meus dados?',
    a: 'Use o formulário de solicitações de titulares. Você recebe um protocolo para acompanhar o atendimento. Não é necessário informar CPF.',
    category: 'Privacidade',
  },
  {
    q: 'Como falar com o suporte?',
    a: 'Pelo formulário de contato, escolhendo a categoria Suporte, ou pela Central de Ajuda. Cada solicitação é registrada com protocolo e respondida pelos canais oficiais.',
    category: 'Suporte',
  },
];

const helpArticles = [
  {
    slug: 'primeiros-passos',
    category: 'Primeiros passos',
    title: 'Começando no Cable',
    summary: 'Crie sua conta, escolha o concurso e entenda a estrutura da plataforma.',
    blocks: [
      {
        h: '1. Crie sua conta',
        p: ['O acesso é feito pelo endereço oficial do aplicativo Cable. O cadastro pede nome e e-mail e define sua senha.'],
      },
      {
        h: '2. Cadastre o concurso',
        p: ['Crie o concurso que você acompanha. Cada concurso tem edital, disciplinas e planejamento próprios.'],
      },
      {
        h: '3. Estruture o edital',
        p: ['Organize o conteúdo programático em disciplinas e tópicos. É essa estrutura que alimenta o planejamento e as estatísticas.'],
      },
      {
        h: '4. Monte o planejamento',
        p: ['Informe sua disponibilidade semanal e distribua os tópicos. Ajuste sempre que a rotina mudar.'],
      },
    ],
  },
  {
    slug: 'conta-e-acesso',
    category: 'Conta e acesso',
    title: 'Acesso, senha e segurança da conta',
    summary: 'Como recuperar o acesso, trocar a senha e proteger sua conta.',
    blocks: [
      {
        h: 'Recuperar acesso',
        p: ['Use a opção de recuperação de senha na tela de login. O link é enviado ao e-mail cadastrado.'],
      },
      {
        h: 'Proteger a conta',
        p: ['Use senha exclusiva e forte, não compartilhe credenciais e ative autenticação em dois fatores quando disponível.'],
      },
      {
        h: 'Encerrar sessão',
        p: ['Encerre a sessão em dispositivos compartilhados. Em caso de suspeita de acesso indevido, altere a senha e contate o suporte.'],
      },
    ],
  },
  {
    slug: 'instalar-aplicativo',
    category: 'Aplicativo',
    title: 'Instalar o Cable no dispositivo',
    summary: 'Instalação como aplicativo no Android, iPhone, iPad, Windows e macOS.',
    blocks: [
      {
        h: 'Android',
        p: ['Abra o endereço oficial no Chrome e use o menu para adicionar à tela inicial, quando o navegador oferecer a opção.'],
      },
      {
        h: 'iPhone e iPad',
        p: ['No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.'],
      },
      {
        h: 'Windows e macOS',
        p: ['Em navegadores compatíveis, use a opção de instalar aplicativo disponível na barra de endereço.'],
      },
      {
        h: 'Observação',
        p: ['A disponibilidade depende da versão publicada e da compatibilidade do dispositivo. Não há instaladores nativos publicados até o momento.'],
      },
    ],
  },
  {
    slug: 'concursos-e-editais',
    category: 'Concursos',
    title: 'Concursos e editais',
    summary: 'Como cadastrar concursos e estruturar o conteúdo programático.',
    blocks: [
      {
        h: 'Cadastrar concurso',
        p: ['Informe órgão, cargo e, se houver, data da prova. Concursos diferentes ficam separados na sua conta.'],
      },
      {
        h: 'Estruturar o edital',
        p: ['Divida o conteúdo programático em disciplinas e tópicos. Marque o que já foi estudado para acompanhar a cobertura.'],
      },
      {
        h: 'Conferir a fonte oficial',
        p: ['O edital oficial publicado pelo órgão é sempre a referência. Confira datas e exigências antes de planejar.'],
      },
    ],
  },
  {
    slug: 'estudos-e-planejamento',
    category: 'Estudos',
    title: 'Planejamento e sessões de estudo',
    summary: 'Como registrar sessões e manter o plano coerente com sua rotina.',
    blocks: [
      {
        h: 'Definir disponibilidade',
        p: ['Informe quantas horas por dia e quais dias você consegue estudar. O plano se ajusta a essa realidade.'],
      },
      {
        h: 'Registrar sessões',
        p: ['Registre tempo, disciplina e tópico estudado. Os registros alimentam o acompanhamento de desempenho.'],
      },
    ],
  },
  {
    slug: 'questoes-e-revisoes',
    category: 'Questões',
    title: 'Questões, caderno de erros e revisões',
    summary: 'Como usar questões e revisões para dirigir o estudo.',
    blocks: [
      {
        h: 'Resolver questões',
        p: ['Registre acertos e erros por tópico para identificar as disciplinas que exigem mais atenção.'],
      },
      {
        h: 'Caderno de erros',
        p: ['As questões erradas ficam reunidas com o motivo do erro, facilitando a revisão dirigida.'],
      },
      {
        h: 'Agendar revisões',
        p: ['Agende revisões dos conteúdos já estudados e acompanhe o que está pendente.'],
      },
    ],
  },
  {
    slug: 'cable-ai',
    category: 'Cable AI',
    title: 'Como usar o Cable AI',
    summary: 'O que a assistência inteligente faz, o que não faz e como conferir as respostas.',
    blocks: [
      {
        h: 'Para que serve',
        p: ['Analisar progresso, identificar dificuldades, sugerir prioridades e apoiar a organização de revisões.'],
      },
      {
        h: 'Limites',
        p: ['As respostas podem conter erros e não substituem o edital oficial. O Cable não garante aprovação.'],
      },
      {
        h: 'Privacidade',
        p: ['Os dados usados nas recomendações são os da sua conta. Veja a Política de Inteligência Artificial para detalhes.'],
      },
    ],
  },
  {
    slug: 'planos-e-pagamentos',
    category: 'Planos',
    title: 'Planos e pagamentos',
    summary: 'Situação atual dos planos e como será a contratação.',
    blocks: [
      {
        h: 'Situação atual',
        p: ['Ainda não há planos com preço publicado nem cobrança ativa. Nenhum pagamento é processado neste momento.'],
      },
      {
        h: 'Quando forem ativados',
        p: ['Cada plano apresentará valor, periodicidade, recursos, limites e condições, com contratação por checkout oficial.'],
      },
    ],
  },
  {
    slug: 'privacidade-e-seguranca',
    category: 'Privacidade',
    title: 'Privacidade e segurança dos seus dados',
    summary: 'Como pedir acesso, correção ou exclusão e como o Cable protege suas informações.',
    blocks: [
      {
        h: 'Seus direitos',
        p: ['Você pode solicitar confirmação de tratamento, acesso, correção, portabilidade, revogação de consentimento e eliminação de dados desnecessários pelo formulário de titulares.'],
      },
      {
        h: 'Segurança',
        p: ['Senhas são armazenadas de forma criptografada, sessões usam cookies protegidos e acessos administrativos são auditados.'],
      },
    ],
  },
  {
    slug: 'integracao',
    category: 'Integrações',
    title: 'Integrações',
    summary: 'Situação das integrações do Cable com outros serviços.',
    blocks: [
      {
        h: 'Status',
        p: ['As integrações com serviços externos estão em desenvolvimento. Nenhuma integração de terceiros está ativa nesta versão do produto.'],
      },
      {
        h: 'Aviso',
        p: ['Quando forem publicadas, as integrações usarão autenticação segura e credenciais armazenadas no servidor.'],
      },
    ],
  },
];

function seedState() {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    settings: {
      brand: {
        name: 'Cable',
        concept: 'Seu concurso. Sua estratégia. Sua evolução.',
        tagline: 'Preparação inteligente para concursos públicos.',
        description:
          'O Cable organiza sua preparação para concursos, acompanha seu desempenho e usa inteligência artificial para apoiar sua rotina de estudos.',
        primaryColor: '#0A1B33',
        accentColor: '#2E6BFF',
      },
      app: {
        url: '',
        status: 'pending',
        version: '',
        pwaEnabled: false,
        androidUrl: '',
        iosUrl: '',
        windowsUrl: '',
        macosUrl: '',
        linuxUrl: '',
        playStoreUrl: '',
        appStoreUrl: '',
        microsoftStoreUrl: '',
      },
      legalEntity: {
        legalName: '',
        tradeName: '',
        cnpj: '',
        address: '',
        email: '',
        supportChannel: '',
        dpo: '',
        billingInfo: '',
      },
      domains: { site: '', app: '', help: '' },
      integrations: {
        analytics: '',
        searchConsole: '',
        emailProvider: '',
        crm: '',
        payments: '',
        notifications: '',
        supportDesk: '',
      },
      social: { instagram: '', youtube: '', linkedin: '', x: '' },
      seo: {
        title: 'Cable — Preparação inteligente para concursos públicos',
        description:
          'Organize seus estudos, acompanhe sua evolução e use inteligência artificial na sua preparação para concursos públicos.',
      },
    },
    plans: [
      {
        id: 'plan_free',
        name: 'Gratuito',
        price: null,
        period: 'mensal',
        status: 'planned',
        highlight: false,
        limits: '',
        benefits: ['Organização de concursos e editais', 'Planejamento de estudos', 'Registro de sessões e questões'],
        cta: 'Lista de interesse',
      },
      {
        id: 'plan_individual',
        name: 'Individual',
        price: null,
        period: 'mensal',
        status: 'planned',
        highlight: true,
        limits: '',
        benefits: ['Todos os recursos do plano gratuito', 'Analytics de desempenho', 'Cable AI para recomendações'],
        cta: 'Lista de interesse',
      },
      {
        id: 'plan_premium',
        name: 'Premium',
        price: null,
        period: 'mensal',
        status: 'planned',
        highlight: false,
        limits: '',
        benefits: ['Recursos do plano Individual', 'Simulados completos', 'Prioridade no suporte'],
        cta: 'Lista de interesse',
      },
    ],
    features,
    faqs,
    helpArticles,
    legalDocs,
    cookiePolicyVersion: '1.0',
    contactRequests: [],
    supportTickets: [],
    newsletterSubscriptions: [],
    privacyRequests: [],
    planInterests: [],
    cookieConsents: [],
    adminUsers: [],
    auditLogs: [],
  };
}

module.exports = { seedState, LEGAL_SLUGS };
