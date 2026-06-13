/*
 * UBIGEO PERÚ — Departamentos, Provincias y Distritos
 * Fuente: INEI - Instituto Nacional de Estadística e Informática
 * Para los selectores de registro de usuario
 */
const PERU_UBIGEO = {
  departamentos: [
    {c:'01',n:'AMAZONAS'}, {c:'02',n:'ÁNCASH'}, {c:'03',n:'APURÍMAC'},
    {c:'04',n:'AREQUIPA'}, {c:'05',n:'AYACUCHO'}, {c:'06',n:'CAJAMARCA'},
    {c:'07',n:'CALLAO'}, {c:'08',n:'CUSCO'}, {c:'09',n:'HUANCAVELICA'},
    {c:'10',n:'HUÁNUCO'}, {c:'11',n:'ICA'}, {c:'12',n:'JUNÍN'},
    {c:'13',n:'LA LIBERTAD'}, {c:'14',n:'LAMBAYEQUE'}, {c:'15',n:'LIMA'},
    {c:'16',n:'LORETO'}, {c:'17',n:'MADRE DE DIOS'}, {c:'18',n:'MOQUEGUA'},
    {c:'19',n:'PASCO'}, {c:'20',n:'PIURA'}, {c:'21',n:'PUNO'},
    {c:'22',n:'SAN MARTÍN'}, {c:'23',n:'TACNA'}, {c:'24',n:'TUMBES'},
    {c:'25',n:'UCAYALI'}
  ],
  provincias: {
    '01':[ {c:'0101',n:'CHACHAPOYAS'},{c:'0102',n:'BAGUA'},{c:'0103',n:'BONGARÁ'},
           {c:'0104',n:'CONDORCANQUI'},{c:'0105',n:'LUYA'},{c:'0106',n:'RODRÍGUEZ DE MENDOZA'},{c:'0107',n:'UTCUBAMBA'} ],
    '02':[ {c:'0201',n:'HUARAZ'},{c:'0202',n:'AIJA'},{c:'0203',n:'ANTONIO RAYMONDI'},{c:'0204',n:'ASUNCIÓN'},
           {c:'0205',n:'BOLOGNESI'},{c:'0206',n:'CARHUAZ'},{c:'0207',n:'CARLOS F. FITZCARRALD'},{c:'0208',n:'CASMA'},
           {c:'0209',n:'CORONGO'},{c:'0210',n:'HUARI'},{c:'0211',n:'HUARMEY'},{c:'0212',n:'HUAYLAS'},
           {c:'0213',n:'MARISCAL LUZURIAGA'},{c:'0214',n:'OCROS'},{c:'0215',n:'PALLASCA'},{c:'0216',n:'POMABAMBA'},
           {c:'0217',n:'RECUAY'},{c:'0218',n:'SANTA'},{c:'0219',n:'SIHUAS'},{c:'0220',n:'YUNGAY'} ],
    '03':[ {c:'0301',n:'ABANCAY'},{c:'0302',n:'ANDAHUAYLAS'},{c:'0303',n:'ANTABAMBA'},
           {c:'0304',n:'AYMARAES'},{c:'0305',n:'COTABAMBAS'},{c:'0306',n:'CHINCHEROS'},{c:'0307',n:'GRAU'} ],
    '04':[ {c:'0401',n:'AREQUIPA'},{c:'0402',n:'CAMANÁ'},{c:'0403',n:'CARAVELÍ'},
           {c:'0404',n:'CASTILLA'},{c:'0405',n:'CAYLLOMA'},{c:'0406',n:'CONDESUYOS'},{c:'0407',n:'ISLAY'},{c:'0408',n:'LA UNIÓN'} ],
    '05':[ {c:'0501',n:'HUAMANGA'},{c:'0502',n:'CANGALLO'},{c:'0503',n:'HUANCA SANCOS'},
           {c:'0504',n:'HUANTA'},{c:'0505',n:'LA MAR'},{c:'0506',n:'LUCANAS'},{c:'0507',n:'PARINACOCHAS'},
           {c:'0508',n:'PÁUCAR DEL SARA SARA'},{c:'0509',n:'SUCRE'},{c:'0510',n:'VÍCTOR FAJARDO'},{c:'0511',n:'VILCAS HUAMÁN'} ],
    '06':[ {c:'0601',n:'CAJAMARCA'},{c:'0602',n:'CAJABAMBA'},{c:'0603',n:'CELENDÍN'},
           {c:'0604',n:'CHOTA'},{c:'0605',n:'CONTUMAZÁ'},{c:'0606',n:'CUTERVO'},{c:'0607',n:'HUALGAYOC'},
           {c:'0608',n:'JAÉN'},{c:'0609',n:'SAN IGNACIO'},{c:'0610',n:'SAN MARCOS'},{c:'0611',n:'SAN MIGUEL'},
           {c:'0612',n:'SAN PABLO'},{c:'0613',n:'SANTA CRUZ'} ],
    '07':[ {c:'0701',n:'CALLAO'} ],
    '08':[ {c:'0801',n:'CUSCO'},{c:'0802',n:'ACOMAYO'},{c:'0803',n:'ANTA'},{c:'0804',n:'CALCA'},
           {c:'0805',n:'CANAS'},{c:'0806',n:'CANCHIS'},{c:'0807',n:'CHUMBIVILCAS'},{c:'0808',n:'ESPINAR'},
           {c:'0809',n:'LA CONVENCIÓN'},{c:'0810',n:'PARURO'},{c:'0811',n:'PAUCARTAMBO'},
           {c:'0812',n:'QUISPICANCHI'},{c:'0813',n:'URUBAMBA'} ],
    '09':[ {c:'0901',n:'HUANCAVELICA'},{c:'0902',n:'ACOBAMBA'},{c:'0903',n:'ANGARAES'},
           {c:'0904',n:'CASTROVIRREYNA'},{c:'0905',n:'CHURCAMPA'},{c:'0906',n:'HUAYTARÁ'},{c:'0907',n:'TAYACAJA'} ],
    '10':[ {c:'1001',n:'HUÁNUCO'},{c:'1002',n:'AMBO'},{c:'1003',n:'DOS DE MAYO'},{c:'1004',n:'HUACAYBAMBA'},
           {c:'1005',n:'HUAMALÍES'},{c:'1006',n:'LEONCIO PRADO'},{c:'1007',n:'MARAÑÓN'},
           {c:'1008',n:'PACHITEA'},{c:'1009',n:'PUERTO INCA'},{c:'1010',n:'LAURICOCHA'},{c:'1011',n:'YAROWILCA'} ],
    '11':[ {c:'1101',n:'ICA'},{c:'1102',n:'CHINCHA'},{c:'1103',n:'NASCA'},{c:'1104',n:'PALPA'},{c:'1105',n:'PISCO'} ],
    '12':[ {c:'1201',n:'HUANCAYO'},{c:'1202',n:'CONCEPCIÓN'},{c:'1203',n:'CHANCHAMAYO'},
           {c:'1204',n:'JUNÍN'},{c:'1205',n:'JUNÍN - SATIPO'},{c:'1206',n:'SATIPO'},{c:'1207',n:'TARMA'},
           {c:'1208',n:'YAULI'},{c:'1209',n:'CHUPACA'} ],
    '13':[ {c:'1301',n:'TRUJILLO'},{c:'1302',n:'ASCOPE'},{c:'1303',n:'BOLÍVAR'},{c:'1304',n:'CHEPÉN'},
           {c:'1305',n:'JULCÁN'},{c:'1306',n:'OTUZCO'},{c:'1307',n:'PACASMAYO'},{c:'1308',n:'PATAZ'},
           {c:'1309',n:'SÁNCHEZ CARRIÓN'},{c:'1310',n:'SANTIAGO DE CHUCO'},{c:'1311',n:'GRAN CHIMÚ'},{c:'1312',n:'VIRÚ'} ],
    '14':[ {c:'1401',n:'CHICLAYO'},{c:'1402',n:'FERREÑAFE'},{c:'1403',n:'LAMBAYEQUE'} ],
    '15':[ {c:'1501',n:'LIMA'},{c:'1502',n:'BARRANCA'},{c:'1503',n:'CAJATAMBO'},{c:'1504',n:'CANTA'},
           {c:'1505',n:'CAÑETE'},{c:'1506',n:'HUARAL'},{c:'1507',n:'HUAROCHIRÍ'},{c:'1508',n:'HUAURA'},
           {c:'1509',n:'OYÓN'},{c:'1510',n:'YAUYOS'} ],
    '16':[ {c:'1601',n:'MAYNAS'},{c:'1602',n:'ALTO AMAZONAS'},{c:'1603',n:'LORETO'},
           {c:'1604',n:'MARISCAL RAMÓN CASTILLA'},{c:'1605',n:'REQUENA'},{c:'1606',n:'UCAYALI'},
           {c:'1607',n:'DATEM DEL MARAÑÓN'},{c:'1608',n:'PUTUMAYO'} ],
    '17':[ {c:'1701',n:'TAMBOPATA'},{c:'1702',n:'MANU'},{c:'1703',n:'TAHUAMANU'} ],
    '18':[ {c:'1801',n:'MARISCAL NIETO'},{c:'1802',n:'GENERAL SÁNCHEZ CERRO'},{c:'1803',n:'ILO'} ],
    '19':[ {c:'1901',n:'PASCO'},{c:'1902',n:'DANIEL ALCIDES CARRIÓN'},{c:'1903',n:'OXAPAMPA'} ],
    '20':[ {c:'2001',n:'PIURA'},{c:'2002',n:'AYABACA'},{c:'2003',n:'HUANCABAMBA'},
           {c:'2004',n:'MORROPÓN'},{c:'2005',n:'PAITA'},{c:'2006',n:'SULLANA'},{c:'2007',n:'TALARA'},{c:'2008',n:'SECHURA'} ],
    '21':[ {c:'2101',n:'PUNO'},{c:'2102',n:'AZÁNGARO'},{c:'2103',n:'CARABAYA'},{c:'2104',n:'CHUCUITO'},
           {c:'2105',n:'EL COLLAO'},{c:'2106',n:'HUANCANÉ'},{c:'2107',n:'LAMPA'},{c:'2108',n:'MELGAR'},
           {c:'2109',n:'MOHO'},{c:'2110',n:'SAN ANTONIO DE PUTINA'},{c:'2111',n:'SAN ROMÁN'},
           {c:'2112',n:'SANDIA'},{c:'2113',n:'YUNGUYO'} ],
    '22':[ {c:'2201',n:'MOYOBAMBA'},{c:'2202',n:'BELLAVISTA'},{c:'2203',n:'EL DORADO'},
           {c:'2204',n:'HUALLAGA'},{c:'2205',n:'LAMAS'},{c:'2206',n:'MARISCAL CÁCERES'},
           {c:'2207',n:'PICOTA'},{c:'2208',n:'RIOJA'},{c:'2209',n:'SAN MARTÍN'},{c:'2210',n:'TOCACHE'} ],
    '23':[ {c:'2301',n:'TACNA'},{c:'2302',n:'CANDARAVE'},{c:'2303',n:'JORGE BASADRE'},{c:'2304',n:'TARATA'} ],
    '24':[ {c:'2401',n:'TUMBES'},{c:'2402',n:'CONTRALMIRANTE VILLAR'},{c:'2403',n:'ZARUMILLA'} ],
    '25':[ {c:'2501',n:'CORONEL PORTILLO'},{c:'2502',n:'ATALAYA'},{c:'2503',n:'PADRE ABAD'},{c:'2504',n:'PURÚS'} ]
  },
  distritos: {
    /* LIMA - distritos completos */
    '1501':[ 'ANCÓN','ATE','BARRANCO','BREÑA','CARABAYLLO','CHACLACAYO','CHORRILLOS','CIENEGUILLA',
             'COMAS','EL AGUSTINO','INDEPENDENCIA','JESÚS MARÍA','LA MOLINA','LA VICTORIA',
             'LINCE','LOS OLIVOS','LURIGANCHO','LURÍN','MAGDALENA DEL MAR','MAGDALENA VIEJA (PUEBLO LIBRE)',
             'MIRAFLORES','PACHACÁMAC','PUCUSANA','PUEBLO LIBRE','PUENTE PIEDRA','PUNTA HERMOSA',
             'PUNTA NEGRA','RÍMAC','SAN BARTOLO','SAN BORJA','SAN ISIDRO','SAN JUAN DE LURIGANCHO',
             'SAN JUAN DE MIRAFLORES','SAN LUIS','SAN MARTÍN DE PORRES','SAN MIGUEL','SANTA ANITA',
             'SANTA MARÍA DEL MAR','SANTA ROSA','SANTIAGO DE SURCO','SURQUILLO','VILLA EL SALVADOR',
             'VILLA MARÍA DEL TRIUNFO' ],
    /* CALLAO - distritos */
    '0701':[ 'BELLAVISTA','CALLAO','CARMEN DE LA LEGUA REYNOSO','LA PERLA','LA PUNTA','MI PERÚ','VENTANILLA' ],
    /* AREQUIPA - distritos */
    '0401':[ 'ALTO SELVA ALEGRE','AREQUIPA','CAYMA','CERRO COLORADO','CHARACATO','CHIGUATA',
             'JACOBO HUNTER','LA JOYA','MARIANO MELGAR','MIRAFLORES','MOLLEBAYA','PAUCARPATA',
             'POCSI','POLOBAYA','QUEQUEÑA','SABANDIA','SACHACA','SAN JUAN DE SIGUAS',
             'SAN JUAN DE TARUCANI','SANTA ISABEL DE SIGUAS','SANTA RITA DE SIGUAS','SOCABAYA',
             'TIABAYA','UCHUMAYO','VITOR','YANAHUARA','YARABAMBA','YURA','JOSÉ LUIS BUSTAMANTE Y RIVERO' ],
    /* CUSCO */
    '0801':[ 'CUSCO','CCORCA','POROY','SAN JERÓNIMO','SAN SEBASTIÁN','SANTIAGO','SAYLLA','WANCHAQ' ],
    /* TRUJILLO */
    '1301':[ 'TRUJILLO','EL PORVENIR','FLORENCIA DE MORA','HUANCHACO','LA ESPERANZA',
             'LAREDO','MOCHE','MOLINO','POROTO','SALAVERRY','SIMBAL','VÍCTOR LARCO HERRERA' ],
    /* CHICLAYO */
    '1401':[ 'CHICLAYO','CHONGOYAPE','ETEN','ETEN PUERTO','JOSÉ LEONARDO ORTIZ','LA VICTORIA',
             'LAGUNAS','MONSEFÚ','NUEVA ARICA','OYOTÚN','PICSI','PIMENTEL','REQUE',
             'SANTA ROSA','SAÑA','CAYALTÍ','PÁTAPO','POMALCA','PUCALÁ','TUMÁN' ],
    /* PIURA */
    '2001':[ 'PIURA','CASTILLA','CATACAOS','CURA MORI','EL TALLÁN','LA ARENA',
             'LA UNIÓN','LAS LOMAS','TAMBOGRANDE','VEINTISÉIS DE OCTUBRE' ],
    /* HUANCAYO */
    '1201':[ 'HUANCAYO','CARHUACALLANGA','CHACAPAMPA','CHICCHE','CHILCA','CHONGOS ALTO',
             'CHUPURO','COLCA','CULLHUAS','EL TAMBO','HUACRAPUQUIO','HUALHUAS','HUANCAN',
             'HUASICANCHA','HUAYUCACHI','INGENIO','PARIAHUANCA','PILCOMAYO','PUCARÁ',
             'QUICHUAY','QUILCAS','SAN AGUSTÍN','SAN JERÓNIMO DE TUNÁN','SAÑO','SAPALLANGA','SICAYA',
             'SANTO DOMINGO DE ACOBAMBA','VIQUES' ]
  }
};

/* Helper: obtener distritos de una provincia */
function getDistritos(codigoProv) {
  const predefined = PERU_UBIGEO.distritos[codigoProv];
  if (predefined) {
    // Si es array de strings, mapear a objetos
    if (typeof predefined[0] === 'string')
      return predefined.map(n => ({ n }));
    return predefined;
  }
  // Fallback: usar el nombre de la provincia como único distrito
  const dep = codigoProv.substring(0, 2);
  const prov = PERU_UBIGEO.provincias[dep]?.find(p => p.c === codigoProv);
  return prov ? [{ n: prov.n }] : [];
}
