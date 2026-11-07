
const code = `#include <Arduino.h>

// ECOSENSE - Sistema inteligente
// Configuração dos componentes

#include <Arduino.h>
#include <Servo.h>

#define BUZZER_ATIVO

#if defined(BUZZER_ATIVO) && defined(BUZZER_PASSIVO)
#error "Escolha apenas UM tipo de buzzer: ativo OU passivo"
#endif
#if !defined(BUZZER_ATIVO) && !defined(BUZZER_PASSIVO)
#error "Descomente um tipo de buzzer: BUZZER_ATIVO ou BUZZER_PASSIVO"
#endif

#define BUZZER_INVERTIDO

#define LDR_MODULO_DIGITAL

#if defined(LDR_MODULO_DIGITAL) && defined(LDR_ANALOGICA)
#error "Escolha apenas UM tipo de sensor de luz: LDR_MODULO_DIGITAL OU LDR_ANALOGICA"
#endif
#if !defined(LDR_MODULO_DIGITAL) && !defined(LDR_ANALOGICA)
#error "Descomente um tipo de sensor de luz: LDR_MODULO_DIGITAL ou LDR_ANALOGICA"
#endif

#define ALARME_QUANDO_FEIXE_CHEGANDO

#if defined(ALARME_QUANDO_FEIXE_CORTADO) && defined(ALARME_QUANDO_FEIXE_CHEGANDO)
#error "Escolha apenas UM modo: ALARME_QUANDO_FEIXE_CORTADO OU ALARME_QUANDO_FEIXE_CHEGANDO"
#endif
#if !defined(ALARME_QUANDO_FEIXE_CORTADO) && !defined(ALARME_QUANDO_FEIXE_CHEGANDO)
#error "Descomente um modo: ALARME_QUANDO_FEIXE_CORTADO ou ALARME_QUANDO_FEIXE_CHEGANDO"
#endif

const int pinoLaser = 7;
#ifdef LDR_ANALOGICA
const int pinoLdr = A0;
#else
const int pinoLdr = 2;
#endif
const int pinoBuzzer = 12;
const int pinoLed = 13;
const int pinoTrig = 4;
const int pinoEcho = 5;
const int pinoServo = 9;

#ifdef LDR_ANALOGICA

const int margemQueda = 150;
const int leiturasCalibracao = 40;
const int diferencaMinimaLaser = 80;

#ifdef LIMIAR_FIXO
const int limiarFixo = 600;
#endif
#else

const int amostrasDoSensor = 3;
#endif

#ifdef BUZZER_PASSIVO
const int frequenciaBuzzer = 2500;
#endif

const unsigned long intervaloLeitura = 20;
const int leiturasParaAcionar = 2;
const int leiturasParaLiberar = 5;
const unsigned long tempoMinimoAlarme = 400;
const unsigned long avisoSemFeixe = 5000;

const int anguloFechado = 0;
const int anguloAberto = 90;

const int distanciaAbrir = 25;
const int distanciaFechar = 35;
const int distanciaMinima = 2;

const unsigned long tempoMinimoAberto = 3000;
const unsigned long intervaloUltrassom = 120;
const int leiturasParaFechar = 3;

const unsigned long intervaloServo = 15;

const unsigned long tempoBipLigado = 120;
const unsigned long tempoBipDesligado = 380;

#ifdef AJUSTE_LUZ
const unsigned long intervaloLog = 200;
#else
const unsigned long intervaloLog = 1000;
#endif

#ifdef LDR_ANALOGICA
int nivelFeixe = 0;
int limiarAtual = 0;
#else
int estadoFeixe = LOW;
#endif
int leituraAtual = 0;
bool alarmeLigado = false;
int contadorInterrompido = 0;
int contadorLivre = 0;
unsigned long momentoAlarme = 0;
unsigned long ultimaLeitura = 0;
unsigned long ultimoLog = 0;
bool avisouSemFeixe = false;
bool buzzerLigadoAgora = false;
unsigned long ultimoBip = 0;

Servo tampa;
int anguloAtual = 0;
int anguloAlvo = 0;
unsigned long ultimoPassoServo = 0;
bool tampaAberta = false;
unsigned long momentoAbertura = 0;
int contadorSemObjeto = 0;
long distanciaAtual = -1;
unsigned long ultimaLeituraUltrassom = 0;

void ligarLaser(bool ligado) {
  digitalWrite(pinoLaser, ligado ? HIGH : LOW);
}

int lerLuz() {
#ifdef LDR_ANALOGICA
  return analogRead(pinoLdr);
#else

  int altos = 0;
  for (int i = 0; i < amostrasDoSensor; i++) {
    if (digitalRead(pinoLdr) == HIGH) {
      altos++;
    }
    delay(1);
  }
  return (altos * 2 > amostrasDoSensor) ? HIGH : LOW;
#endif
}

int medirLuzCalibracao() {
#ifdef LDR_ANALOGICA
  long soma = 0;
  for (int i = 0; i < leiturasCalibracao; i++) {
    soma += analogRead(pinoLdr);
    delay(5);
  }
  return soma / leiturasCalibracao;
#else

  int altos = 0;
  for (int i = 0; i < 5; i++) {
    if (digitalRead(pinoLdr) == HIGH) altos++;
    delay(5);
  }
  return (altos >= 3) ? HIGH : LOW;
#endif
}

bool feixeInterrompido(int leitura) {
#ifdef LDR_ANALOGICA
  return leitura < limiarAtual;
#else
  return leitura != estadoFeixe;
#endif
}

void acionarBuzzer(bool ligado) {
#ifdef BUZZER_INVERTIDO
  ligado = !ligado;
#endif
#ifdef BUZZER_ATIVO
  digitalWrite(pinoBuzzer, ligado ? HIGH : LOW);
#else
  if (ligado) {
    tone(pinoBuzzer, frequenciaBuzzer);
  } else {
    noTone(pinoBuzzer);
  }
#endif
}

void atualizarBuzzer() {
#ifdef SOM_CONTINUO

#else
  if (!alarmeLigado) {
    return;
  }

  unsigned long agora = millis();
  unsigned long espera = buzzerLigadoAgora ? tempoBipLigado : tempoBipDesligado;

  if (agora - ultimoBip >= espera) {
    ultimoBip = agora;
    buzzerLigadoAgora = !buzzerLigadoAgora;
    acionarBuzzer(buzzerLigadoAgora);
  }
#endif
}

long medirDistancia() {
  digitalWrite(pinoTrig, LOW);
  delayMicroseconds(2);
  digitalWrite(pinoTrig, HIGH);
  delayMicroseconds(10);
  digitalWrite(pinoTrig, LOW);

  unsigned long duracao = pulseIn(pinoEcho, HIGH, 15000);
  if (duracao == 0) {
    return -1;
  }
  return (long)(duracao * 0.034 / 2);
}

void abrirTampa() {
  tampaAberta = true;
  anguloAlvo = anguloAberto;
  momentoAbertura = millis();
  contadorSemObjeto = 0;

  Serial.print(F(">> LIXEIRA: obstaculo a "));
  Serial.print(distanciaAtual);
  Serial.println(F(" cm -> abrindo a tampa"));
}

void fecharTampa() {
  tampaAberta = false;
  anguloAlvo = anguloFechado;

  Serial.println(F(">> LIXEIRA: frente livre -> fechando a tampa"));
}

void atualizarServo() {
  if (anguloAtual == anguloAlvo) {
    return;
  }

#ifdef SERVO_DEVAGAR
  unsigned long agora = millis();
  if (agora - ultimoPassoServo < intervaloServo) {
    return;
  }
  ultimoPassoServo = agora;

  if (anguloAtual < anguloAlvo) {
    anguloAtual++;
  } else {
    anguloAtual--;
  }
  tampa.write(anguloAtual);
#else

  anguloAtual = anguloAlvo;
  tampa.write(anguloAtual);
#endif
}

void atualizarLixeira() {
  unsigned long agora = millis();

  if (agora - ultimaLeituraUltrassom < intervaloUltrassom) {
    return;
  }
  ultimaLeituraUltrassom = agora;

  distanciaAtual = medirDistancia();

  bool objetoPerto = (distanciaAtual >= distanciaMinima &&
                      distanciaAtual <= distanciaAbrir);
  bool frenteLivre = (distanciaAtual < 0) ||
                     (distanciaAtual > distanciaFechar);

  if (!tampaAberta) {
    if (objetoPerto) {
      abrirTampa();
    }
  } else {
    contadorSemObjeto = frenteLivre ? contadorSemObjeto + 1 : 0;

    if ((agora - momentoAbertura) >= tempoMinimoAberto &&
        contadorSemObjeto >= leiturasParaFechar) {
      fecharTampa();
    }
  }
}

void calibrarFeixe() {
  Serial.println(F("Calibrando o sensor de luz..."));

  ligarLaser(false);
  delay(250);
  int semLaser = medirLuzCalibracao();

  ligarLaser(true);
  delay(250);
  int comLaser = medirLuzCalibracao();

  bool laserVisto;

#ifdef LDR_ANALOGICA
  nivelFeixe = comLaser;

#ifdef LIMIAR_FIXO
  limiarAtual = limiarFixo;
#else

  limiarAtual = nivelFeixe - margemQueda;
#endif

  Serial.print(F("Laser DESLIGADO: leitura "));
  Serial.println(semLaser);
  Serial.print(F("Laser LIGADO:    leitura "));
  Serial.print(nivelFeixe);
  Serial.print(F("  (diferenca de "));
  Serial.print(comLaser - semLaser);
  Serial.println(F(")"));
  Serial.print(F("Limiar de disparo:        "));
  Serial.println(limiarAtual);

  laserVisto = (comLaser - semLaser) >= diferencaMinimaLaser;
#else
  estadoFeixe = (comLaser == HIGH) ? HIGH : LOW;

  Serial.print(F("Laser DESLIGADO: DO em "));
  Serial.println(semLaser == HIGH ? "HIGH (5 V)" : "LOW (0 V)");
  Serial.print(F("Laser LIGADO:    DO em "));
  Serial.println(estadoFeixe == HIGH ? "HIGH (5 V)" : "LOW (0 V)");
  Serial.println(F("(esse e o estado de repouso: DO com o feixe chegando)"));

  laserVisto = (semLaser != comLaser);
#endif

  if (!laserVisto) {
    Serial.println(F("!! ATENCAO: o laser NAO mudou a leitura do sensor."));
    Serial.println(F("!! 1) mire o ponto vermelho em cima da LDR (confira de lado,"));
    Serial.println(F("!!    nunca olhando para o feixe) e aproxime o laser;"));
    Serial.println(F("!! 2) gire o potenciometro do modulo ate o LED dele reagir"));
    Serial.println(F("!!    quando voce corta o feixe com a mao."));
    Serial.println(F("!! Sem essa diferenca o alarme NUNCA dispara."));
  }
}

void ligarAlarme() {
  alarmeLigado = true;
  momentoAlarme = millis();
  avisouSemFeixe = false;

#ifndef SOM_CONTINUO

  buzzerLigadoAgora = true;
  ultimoBip = millis();
#endif

  acionarBuzzer(true);
  digitalWrite(pinoLed, HIGH);

#ifdef ALARME_QUANDO_FEIXE_CHEGANDO
  Serial.print(F(">> FEIXE CHEGANDO NO SENSOR: alarme LIGADO ("));
#else
  Serial.print(F(">> FEIXE INTERROMPIDO: alarme LIGADO ("));
#endif
#ifdef LDR_ANALOGICA
  Serial.print(F("luz "));
  Serial.print(leituraAtual);
  Serial.print(F(" / limiar "));
  Serial.print(limiarAtual);
#else
  Serial.print(F("DO "));
  Serial.print(leituraAtual == HIGH ? "HIGH" : "LOW");
  Serial.print(F(", esperado "));
  Serial.print(estadoFeixe == HIGH ? "HIGH" : "LOW");
#endif
  Serial.println(F(")"));

#ifndef ALARME_QUANDO_FEIXE_CHEGANDO

  if (millis() < 5000) {
    Serial.println(F("!! Alarme disparou logo apos ligar: se o feixe esta livre,"));
    Serial.println(F("!! confira a mira e o potenciometro do sensor. Se o buzzer"));
    Serial.println(F("!! apita mesmo com a barreira livre, troque a opcao"));
    Serial.println(F("!! BUZZER_INVERTIDO no topo deste arquivo."));
  }
#endif
}

void desligarAlarme() {
  alarmeLigado = false;
  contadorLivre = 0;
  buzzerLigadoAgora = false;

  acionarBuzzer(false);
  digitalWrite(pinoLed, LOW);

#ifdef ALARME_QUANDO_FEIXE_CHEGANDO
  Serial.println(F(">> FEIXE CORTADO: alarme desligado (mudo) ate o feixe voltar"));
#else
  Serial.println(F(">> FEIXE RESTABELECIDO: alarme desligado, barreira armada de novo"));
#endif
}

void registrarDiagnostico() {
  unsigned long agora = millis();

  if (agora - ultimoLog < intervaloLog) {
    return;
  }
  ultimoLog = agora;

#ifdef LDR_ANALOGICA
  Serial.print(F("luz: "));
  Serial.print(leituraAtual);
  Serial.print(F("  | limiar: "));
  Serial.print(limiarAtual);
#else
  Serial.print(F("DO: "));
  Serial.print(leituraAtual == HIGH ? "HIGH" : "LOW ");
  Serial.print(F("  | DO com feixe: "));
  Serial.print(estadoFeixe == HIGH ? "HIGH" : "LOW ");
#endif
  Serial.print(F("  | feixe: "));
  if (feixeInterrompido(leituraAtual)) {
    Serial.print(F("INTERROMPIDO"));
  } else {
    Serial.print(F("OK        "));
  }
  Serial.print(F("  | alarme: "));
  Serial.print(alarmeLigado ? F("LIGADO") : F("desligado"));
  Serial.print(F("  | som: "));
  Serial.print(alarmeLigado ? F("bipando") : F("mudo"));
  Serial.print(F("  | dist: "));
  if (distanciaAtual < 0) {
    Serial.print(F("--"));
  } else {
    Serial.print(distanciaAtual);
  }
  Serial.print(F(" cm  | tampa: "));
  Serial.println(tampaAberta ? F("ABERTA") : F("FECHADA"));
}

void setup() {
  Serial.begin(9600);

  pinMode(pinoLaser, OUTPUT);
  pinMode(pinoBuzzer, OUTPUT);
  pinMode(pinoLed, OUTPUT);
  pinMode(pinoTrig, OUTPUT);
  pinMode(pinoEcho, INPUT);
#ifdef LDR_ANALOGICA
  pinMode(pinoLdr, INPUT);
#else
  pinMode(pinoLdr, INPUT_PULLUP);
#endif

  ligarLaser(true);
  acionarBuzzer(false);
  digitalWrite(pinoLed, LOW);

  Serial.println(F("=========================================="));
  Serial.println(F("  Arduino Uno - Alarme de Barreira a Laser"));
  Serial.println(F("=========================================="));
  Serial.print(F("Pino "));
  Serial.print(pinoLaser);
  Serial.println(F(" : S do laser KY-008"));
#ifdef LDR_ANALOGICA
  Serial.println(F("Pino A0: LDR (divisor com resistor 10k)"));
#else
  Serial.print(F("Pino "));
  Serial.print(pinoLdr);
  Serial.println(F(" : DO do modulo de luz (VCC/GND/DO)"));
#endif
  Serial.print(F("Pino "));
  Serial.print(pinoBuzzer);
  Serial.println(F(" : buzzer"));
  Serial.print(F("Pino "));
  Serial.print(pinoLed);
  Serial.println(F(" : LED da placa (indicador)"));
  Serial.print(F("Pino "));
  Serial.print(pinoTrig);
  Serial.println(F(" : Trig do HC-SR04 (lixeira)"));
  Serial.print(F("Pino "));
  Serial.print(pinoEcho);
  Serial.println(F(" : Echo do HC-SR04 (lixeira)"));
  Serial.print(F("Pino "));
  Serial.print(pinoServo);
  Serial.println(F(" : servo da tampa (lixeira)"));
  Serial.print(F("Tempo minimo de apito: "));
  Serial.print(tempoMinimoAlarme);
  Serial.println(F(" ms"));

  Serial.print(F("Lixeira: abre com obstaculo < "));
  Serial.print(distanciaAbrir);
  Serial.print(F(" cm  |  servo: "));
  Serial.print(anguloFechado);
  Serial.print(F(" -> "));
  Serial.print(anguloAberto);
  Serial.print(F(" graus ("));
#ifdef SERVO_DEVAGAR
  unsigned long msMovimento =
      (unsigned long)(anguloAberto - anguloFechado) * intervaloServo;
  Serial.print(F("devagar, "));
  Serial.print(msMovimento);
  Serial.println(F(" ms)"));
#else
  Serial.println(F("velocidade normal)"));
#endif
  Serial.println(F("------------------------------------------"));

  tampa.attach(pinoServo);
  tampa.write(anguloFechado);
  anguloAtual = anguloFechado;
  anguloAlvo = anguloFechado;
  delay(400);

  calibrarFeixe();

  Serial.println(F("------------------------------------------"));
#ifdef ALARME_QUANDO_FEIXE_CHEGANDO
  Serial.println(F("Modo INVERSO ativo: o buzzer apita enquanto o feixe"));
  Serial.println(F("esta CHEGANDO no sensor e fica MUDO quando o feixe"));
  Serial.println(F("e cortado. Para o modo barreira, troque a opcao"));
  Serial.println(F("ALARME_QUANDO_FEIXE_CHEGANDO no topo do arquivo."));
#else
  Serial.println(F("Barreira ARMADA. Passe algo na frente do laser."));
  Serial.println(F("Ao cortar o feixe saem BIPS CURTOS (nao apito continuo)."));
  Serial.println(F("Se o buzzer apitar com o feixe livre, troque a opcao"));
  Serial.println(F("BUZZER_INVERTIDO (comente/descomente) no topo do arquivo."));
#endif
  Serial.println(F("------------------------------------------"));
}

void loop() {
  unsigned long agora = millis();

  if (agora - ultimaLeitura >= intervaloLeitura) {
    ultimaLeitura = agora;

    leituraAtual = lerLuz();
    bool feixeCortado = feixeInterrompido(leituraAtual);

#ifdef ALARME_QUANDO_FEIXE_CHEGANDO

    bool condicaoAlarme = !feixeCortado;
#else

    bool condicaoAlarme = feixeCortado;
#endif

    if (condicaoAlarme) {
      contadorInterrompido++;
      contadorLivre = 0;
    } else {
      contadorLivre++;
      contadorInterrompido = 0;
    }

    if (!alarmeLigado) {

      if (contadorInterrompido >= leiturasParaAcionar) {
        ligarAlarme();
      }
    } else {

      bool situacaoNormal = contadorLivre >= leiturasParaLiberar;
      bool tempoCumprido = (millis() - momentoAlarme) >= tempoMinimoAlarme;

      if (situacaoNormal && tempoCumprido) {
        desligarAlarme();
      } else if (!avisouSemFeixe && (millis() - momentoAlarme) >= avisoSemFeixe) {

        avisouSemFeixe = true;
#ifdef ALARME_QUANDO_FEIXE_CHEGANDO
        Serial.println(F(">> ALARME LIGADO HA MUITO TEMPO: se o feixe esta chegando, e normal"));
#else
        Serial.println(F(">> BARREIRA INTERROMPIDA HA MUITO TEMPO: confira a mira do laser e a LDR"));
#endif
      }
    }
  }

  atualizarBuzzer();
  atualizarLixeira();
  atualizarServo();

  registrarDiagnostico();
}
`;

// ELEMENTOS
const output = document.getElementById("output");
const numbers = document.getElementById("numbers");
const status = document.getElementById("status");
const cursor = document.getElementById("cursor");
const editor = document.getElementById("editor");
const modeText = document.getElementById("modeText");
const normalButton = document.getElementById("normalButton");
const codeArea = document.getElementById("codeArea");

// CONFIGURAÇÕES
let position = 0;
let timer = null;
let restartTimer = null;

let typing = false;
let normalMode = false;

const speed = 12;
const charactersPerStep = 1;

// COLORAÇÃO C++
function highlightCode(text) {

    const escaped = text.replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);

    const regex =
        /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#\s*[a-zA-Z_]\w*|\b(?:void|int|float|double|char|bool|string|long|short|unsigned|const|static|auto)\b|\b(?:if|else|for|while|do|return|break|continue|switch|case|default|class|public|private|struct|true|false)\b|\b(?:HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*(?=\s*\())/g;

    return escaped.replace(regex, token => {

        let className = "";

        if (/^\/\//.test(token) || /^\/\*/.test(token)) {
            className = "token-comment";
        }
        else if (/^["']/.test(token)) {
            className = "token-string";
        }
        else if (/^#/.test(token)) {
            className = "token-preprocessor";
        }
        else if (/^(void|int|float|double|char|bool|string|long|short|unsigned|const|static|auto)$/.test(token)) {
            className = "token-type";
        }
        else if (/^(if|else|for|while|do|return|break|continue|switch|case|default|class|public|private|struct|true|false)$/.test(token)) {
            className = "token-keyword";
        }
        else if (/^(HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP)$/.test(token)) {
            className = "token-constant";
        }
        else if (/^\d/.test(token)) {
            className = "token-number";
        }
        else {
            className = "token-function";
        }

        return `<span class="${className}">${token}</span>`;
    });
}

// ATUALIZAR NÚMEROS
function updateLineNumbers(text) {

    const totalLines = text.split("\n").length;

    numbers.innerHTML = Array.from(
        { length: totalLines },
        (_, i) => `<div class="line-number">${i + 1}</div>`
    ).join("");
}

// ROLAGEM AUTOMÁTICA
function followCode() {

    const lastLine = output.lastElementChild;

    if (lastLine) {
        const lineBottom = lastLine.offsetTop + lastLine.offsetHeight;
        const visibleBottom = codeArea.scrollTop + codeArea.clientHeight;

        if (lineBottom > visibleBottom - 30) {
            codeArea.scrollTop = lineBottom - codeArea.clientHeight + 50;
        }
    }

    numbers.scrollTop = codeArea.scrollTop;
}

// ATUALIZAR EDITOR
function updateEditor() {

    const visibleCode = code.substring(0, position);

    output.innerHTML = highlightCode(visibleCode);

    updateLineNumbers(visibleCode);

    followCode();
}

// INICIAR DIGITAÇÃO
function start() {

    if (normalMode || typing) return;

    clearTimeout(restartTimer);

    if (position >= code.length) {
        position = 0;
        updateEditor();
        codeArea.scrollTop = 0;
    }

    typing = true;

    status.textContent = "● TYPING";
    status.style.color = "#3998ff";

    cursor.style.display = "inline-block";

    timer = setInterval(() => {

        position += charactersPerStep;

        if (position >= code.length) {

            position = code.length;
            updateEditor();

            pause();

            status.textContent = "● RESTARTING";
            status.style.color = "#e5c07b";

            restartTimer = setTimeout(() => {

                if (!normalMode) {

                    position = 0;
                    codeArea.scrollTop = 0;

                    updateEditor();

                    start();
                }

            }, 1200);

            return;
        }

        updateEditor();

    }, speed);
}

// PAUSAR
function pause() {

    clearInterval(timer);
    timer = null;

    clearTimeout(restartTimer);
    restartTimer = null;

    typing = false;

    if (!normalMode) {

        status.textContent = "● PAUSED";
        status.style.color = "#e5c07b";
    }
}

// REINICIAR
function reset() {

    pause();

    normalMode = false;
    position = 0;

    output.innerHTML = "";
    updateLineNumbers("");

    codeArea.scrollTop = 0;
    numbers.scrollTop = 0;

    cursor.style.display = "inline-block";

    status.textContent = "● READY";
    status.style.color = "#65e6a8";

    modeText.textContent = "MODO: DIGITAÇÃO AUTOMÁTICA";

    normalButton.innerHTML = 'CÓDIGO NORMAL <kbd>B</kbd>';

    start();
}

// MODO CÓDIGO NORMAL
function toggleNormalMode() {

    if (!normalMode) {

        pause();

        normalMode = true;
        position = code.length;

        output.innerHTML = highlightCode(code);
        updateLineNumbers(code);

        cursor.style.display = "none";

        status.textContent = "● FULL CODE";
        status.style.color = "#65e6a8";

        modeText.textContent = "MODO: CÓDIGO COMPLETO";

        normalButton.innerHTML = 'ATIVAR ANIMAÇÃO <kbd>B</kbd>';

        codeArea.scrollTop = 0;
        numbers.scrollTop = 0;

    } else {

        normalMode = false;
        position = 0;

        output.innerHTML = "";
        updateLineNumbers("");

        codeArea.scrollTop = 0;
        numbers.scrollTop = 0;

        cursor.style.display = "inline-block";

        modeText.textContent = "MODO: DIGITAÇÃO AUTOMÁTICA";

        normalButton.innerHTML = 'CÓDIGO NORMAL <kbd>B</kbd>';

        status.textContent = "● READY";
        status.style.color = "#65e6a8";

        start();
    }
}

// COPIAR CÓDIGO
function copyCode() {

    navigator.clipboard.writeText(code)
        .then(() => {

            status.textContent = "● COPIED";
            status.style.color = "#65e6a8";

        })
        .catch(() => {

            status.textContent = "● COPY ERROR";

        });
}

// TELA CHEIA
async function toggleFullscreen() {

    try {

        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else {
            await editor.requestFullscreen();
        }

    } catch (error) {

        console.error("Erro na tela cheia:", error);

    }
}

// BOTÃO DE TELA CHEIA
document.addEventListener("fullscreenchange", () => {

    const button = document.querySelector(".fullscreen-btn");

    if (!button) return;

    if (document.fullscreenElement) {
        button.innerHTML = '⛶ SAIR <kbd>F</kbd>';
    } else {
        button.innerHTML = '⛶ TELA CHEIA <kbd>F</kbd>';
    }

});

// ROLAGEM SINCRONIZADA
codeArea.addEventListener("scroll", () => {
    numbers.scrollTop = codeArea.scrollTop;
});

// ATALHOS DE TECLADO
document.addEventListener("keydown", event => {

    const active = document.activeElement;

    const isTypingInInput =
        ["INPUT", "TEXTAREA"].includes(active.tagName) ||
        active.isContentEditable;

    if (isTypingInInput) return;

    if (event.code === "Space") {

        event.preventDefault();

        if (normalMode) return;

        if (typing) {
            pause();
        } else {
            start();
        }
    }

    if (event.key.toLowerCase() === "f") {

        event.preventDefault();
        toggleFullscreen();
    }

    if (event.key.toLowerCase() === "b") {

        event.preventDefault();
        toggleNormalMode();
    }

});

// INICIAR
updateLineNumbers("");
start();
