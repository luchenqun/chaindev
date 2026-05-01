'use client';

import { IconArrowsExchange, IconCopy } from '@tabler/icons-react';
import { type KeyboardEvent, useMemo, useState } from 'react';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/ui/copy-text';
import { AppShell } from '@/platform/layout/app-shell';

type OperationId = 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'mod' | 'and' | 'or' | 'xor';
type CalculatorMode = 'operands' | 'expression';

type OperationDefinition = {
  id: OperationId;
  label: string;
};

const OPERATION_DEFINITIONS: OperationDefinition[] = [
  { id: 'add', label: 'A + B' },
  { id: 'subtract', label: 'A - B' },
  { id: 'multiply', label: 'A * B' },
  { id: 'divide', label: 'A / B' },
  { id: 'power', label: 'A^B' },
  { id: 'mod', label: 'A MOD B' },
  { id: 'and', label: 'A AND B' },
  { id: 'or', label: 'A OR B' },
  { id: 'xor', label: 'A XOR B' },
];

type ResultBase = 'decimal' | 'hex';

function parseBigInteger(value: string, fieldLabel: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`${fieldLabel} is required.`);
  }

  return BigInt(trimmedValue);
}

function normalizeModulo(value: bigint, modulo: bigint) {
  return ((value % modulo) + modulo) % modulo;
}

function computeResult(operationId: OperationId, rawA: string, rawB: string) {
  const a = parseBigInteger(rawA, 'Number (A)');
  const b = parseBigInteger(rawB, 'Number (B)');

  switch (operationId) {
    case 'add':
      return (a + b).toString();
    case 'subtract':
      return (a - b).toString();
    case 'multiply':
      return (a * b).toString();
    case 'divide':
      if (b === 0n) {
        throw new Error('Division by zero is not allowed.');
      }
      return (a / b).toString();
    case 'power':
      if (b < 0n) {
        throw new Error('Exponent must be zero or a positive integer.');
      }
      return (a ** b).toString();
    case 'mod':
      if (b === 0n) {
        throw new Error('Modulo by zero is not allowed.');
      }
      return normalizeModulo(a, b).toString();
    case 'and':
      return (a & b).toString();
    case 'or':
      return (a | b).toString();
    case 'xor':
      return (a ^ b).toString();
    default:
      return '';
  }
}

function formatBigIntForBase(value: bigint, base: ResultBase) {
  if (base === 'decimal') {
    return value.toString();
  }

  const prefix = value < 0n ? '-0x' : '0x';
  const absoluteValue = value < 0n ? -value : value;
  return `${prefix}${absoluteValue.toString(16)}`;
}

function isDigit(character: string) {
  return character >= '0' && character <= '9';
}

function isHexDigit(character: string) {
  return (
    (character >= '0' && character <= '9') ||
    (character >= 'a' && character <= 'f') ||
    (character >= 'A' && character <= 'F')
  );
}

function tokenizeExpression(expression: string) {
  const tokens: string[] = [];
  let index = 0;

  while (index < expression.length) {
    const character = expression[index];

    if (character.trim() === '') {
      index += 1;
      continue;
    }

    if (character === '(' || character === ')' || character === '^' || character === '*' || character === '/' || character === '+' || character === '%') {
      tokens.push(character);
      index += 1;
      continue;
    }

    if (character === '-') {
      const previousToken = tokens.at(-1);
      const unaryMinus = !previousToken || previousToken === '(' || previousToken === '+' || previousToken === '-' || previousToken === '*' || previousToken === '/' || previousToken === '^' || previousToken === '%';

      if (unaryMinus) {
        let numberToken = '-';
        index += 1;

        if (expression[index] === '0' && (expression[index + 1] === 'x' || expression[index + 1] === 'X')) {
          numberToken += '0';
          numberToken += expression[index + 1];
          index += 2;

          while (index < expression.length && isHexDigit(expression[index])) {
            numberToken += expression[index];
            index += 1;
          }

          if (numberToken === '-0x' || numberToken === '-0X') {
            throw new Error('Invalid expression.');
          }

          tokens.push(numberToken);
          continue;
        }

        while (index < expression.length && isDigit(expression[index])) {
          numberToken += expression[index];
          index += 1;
        }

        if (numberToken === '-') {
          throw new Error('Invalid expression.');
        }

        tokens.push(numberToken);
        continue;
      }

      tokens.push(character);
      index += 1;
      continue;
    }

    if (isDigit(character)) {
      let numberToken = '';

      if (character === '0' && (expression[index + 1] === 'x' || expression[index + 1] === 'X')) {
        numberToken += '0';
        numberToken += expression[index + 1];
        index += 2;

        while (index < expression.length && isHexDigit(expression[index])) {
          numberToken += expression[index];
          index += 1;
        }

        if (numberToken === '0x' || numberToken === '0X') {
          throw new Error('Invalid expression.');
        }

        tokens.push(numberToken);
        continue;
      }

      while (index < expression.length && isDigit(expression[index])) {
        numberToken += expression[index];
        index += 1;
      }

      tokens.push(numberToken);
      continue;
    }

    throw new Error(`Unsupported character: ${character}`);
  }

  return tokens;
}

function parseExpressionNumberToken(token: string) {
  if (token.startsWith('-0x') || token.startsWith('-0X')) {
    return -BigInt(token.slice(1));
  }

  return BigInt(token);
}

function getOperatorPrecedence(operator: string) {
  switch (operator) {
    case '^':
      return 3;
    case '*':
    case '/':
    case '%':
      return 2;
    case '+':
    case '-':
      return 1;
    default:
      return 0;
  }
}

function applyBinaryOperator(operator: string, left: bigint, right: bigint) {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      if (right === 0n) {
        throw new Error('Division by zero is not allowed.');
      }
      return left / right;
    case '%':
      if (right === 0n) {
        throw new Error('Modulo by zero is not allowed.');
      }
      return normalizeModulo(left, right);
    case '^':
      if (right < 0n) {
        throw new Error('Exponent must be zero or a positive integer.');
      }
      return left ** right;
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

function reduceTopOperator(operators: string[], values: bigint[]) {
  const operator = operators.pop();

  if (!operator) {
    throw new Error('Invalid expression.');
  }

  const right = values.pop();
  const left = values.pop();

  if (left === undefined || right === undefined) {
    throw new Error('Invalid expression.');
  }

  values.push(applyBinaryOperator(operator, left, right));
}

function evaluateExpression(expression: string) {
  const trimmedExpression = expression.trim();

  if (!trimmedExpression) {
    throw new Error('Expression is required.');
  }

  const tokens = tokenizeExpression(trimmedExpression);
  const operators: string[] = [];
  const values: bigint[] = [];

  for (const token of tokens) {
    if (/^-?(?:\d+|0[xX][0-9a-fA-F]+)$/.test(token)) {
      values.push(parseExpressionNumberToken(token));
      continue;
    }

    if (token === '(') {
      operators.push(token);
      continue;
    }

    if (token === ')') {
      while (operators.length > 0 && operators[operators.length - 1] !== '(') {
        reduceTopOperator(operators, values);
      }

      if (operators.pop() !== '(') {
        throw new Error('Mismatched parentheses.');
      }

      continue;
    }

    while (operators.length > 0 && operators[operators.length - 1] !== '(') {
      const topOperator = operators[operators.length - 1];
      const topPrecedence = getOperatorPrecedence(topOperator);
      const currentPrecedence = getOperatorPrecedence(token);
      const shouldReduce = token === '^' ? topPrecedence > currentPrecedence : topPrecedence >= currentPrecedence;

      if (!shouldReduce) {
        break;
      }

      reduceTopOperator(operators, values);
    }

    operators.push(token);
  }

  while (operators.length > 0) {
    if (operators[operators.length - 1] === '(') {
      throw new Error('Mismatched parentheses.');
    }

    reduceTopOperator(operators, values);
  }

  if (values.length !== 1) {
    throw new Error('Invalid expression.');
  }

  return values[0].toString();
}

export default function BigNumberPage() {
  const [mode, setMode] = useState<CalculatorMode>('operands');
  const [numberA, setNumberA] = useState('');
  const [numberB, setNumberB] = useState('');
  const [activeOperation, setActiveOperation] = useState<OperationId | null>(null);
  const [expression, setExpression] = useState('');
  const [expressionSubmitted, setExpressionSubmitted] = useState(false);
  const [resultBase, setResultBase] = useState<ResultBase>('decimal');
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => {
    if (mode === 'expression') {
      if (!expressionSubmitted) {
        return {
          value: '',
          error: null,
        };
      }

      try {
        return {
          value: evaluateExpression(expression),
          error: null,
        };
      } catch (error) {
        return {
          value: '',
          error: error instanceof Error ? error.message : 'Computation failed.',
        };
      }
    }

    if (!activeOperation) {
      return {
        value: '',
        error: null,
      };
    }

    try {
      return {
        value: computeResult(activeOperation, numberA, numberB),
        error: null,
      };
    } catch (error) {
      return {
        value: '',
        error: error instanceof Error ? error.message : 'Computation failed.',
      };
    }
  }, [activeOperation, expression, expressionSubmitted, mode, numberA, numberB]);

  const displayedResult = useMemo(() => {
    if (output.error || !output.value.trim()) {
      return output.error || output.value;
    }

    try {
      return formatBigIntForBase(BigInt(output.value), resultBase);
    } catch {
      return output.value;
    }
  }, [output.error, output.value, resultBase]);

  async function handleCopy() {
    const valueToCopy = displayedResult;

    if (!valueToCopy.trim()) {
      return;
    }

    await copyText(valueToCopy);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1200);
  }

  function handleToggleResultBase() {
    setResultBase((current) => (current === 'decimal' ? 'hex' : 'decimal'));
  }

  function handleModeChange(nextMode: CalculatorMode) {
    setMode(nextMode);
    setCopied(false);
    setResultBase('decimal');
  }

  function handleCalculateExpression() {
    setExpressionSubmitted(true);
  }

  function handleClearExpression() {
    setExpression('');
    setExpressionSubmitted(false);
    setCopied(false);
    setResultBase('decimal');
  }

  function handleExpressionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleCalculateExpression();
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-[1400px] px-3 pb-10">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 items-baseline gap-3">
                  <h1 className="shrink-0 text-2xl font-semibold text-slate-950">Big Number Calculator</h1>
                  <p className="min-w-0 truncate text-sm text-slate-500">Large integer math in the browser.</p>
                </div>
              </div>

              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  className={
                    mode === 'operands'
                      ? 'min-w-[96px] rounded-[14px] bg-white px-4 py-1.5 text-sm font-semibold text-slate-950 shadow-[0_6px_14px_rgba(15,23,42,0.06)]'
                      : 'min-w-[96px] rounded-[14px] px-4 py-1.5 text-sm font-semibold text-slate-500'
                  }
                  onClick={() => handleModeChange('operands')}
                >
                  Operands
                </button>
                <button
                  type="button"
                  className={
                    mode === 'expression'
                      ? 'min-w-[96px] rounded-[14px] bg-white px-4 py-1.5 text-sm font-semibold text-slate-950 shadow-[0_6px_14px_rgba(15,23,42,0.06)]'
                      : 'min-w-[96px] rounded-[14px] px-4 py-1.5 text-sm font-semibold text-slate-500'
                  }
                  onClick={() => handleModeChange('expression')}
                >
                  Expression
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-8 px-6 py-6">
            {mode === 'operands' ? (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <label className="block text-[18px] font-semibold text-slate-950" htmlFor="big-number-a">
                      Number (A)
                    </label>
                    <textarea
                      id="big-number-a"
                      value={numberA}
                      className="mt-3 min-h-[170px] w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-[20px] leading-8 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-sky-400"
                      placeholder="Enter an integer"
                      onChange={(event) => setNumberA(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[18px] font-semibold text-slate-950" htmlFor="big-number-b">
                      Number (B)
                    </label>
                    <textarea
                      id="big-number-b"
                      value={numberB}
                      className="mt-3 min-h-[170px] w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-[20px] leading-8 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-sky-400"
                      placeholder="Enter an integer"
                      onChange={(event) => setNumberB(event.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <h2 className="text-[18px] font-semibold text-slate-950">Calculate</h2>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {OPERATION_DEFINITIONS.map((operation) => (
                      <Button
                        key={operation.id}
                        type="button"
                        variant={operation.id === activeOperation ? 'default' : 'outline'}
                        className={
                          operation.id === activeOperation
                            ? 'h-11 rounded-xl bg-sky-600 px-6 text-white hover:bg-sky-700'
                            : 'h-11 rounded-xl border-slate-200 px-6 text-slate-700 hover:bg-slate-50'
                        }
                        onClick={() => setActiveOperation(operation.id)}
                      >
                        <span className="text-[18px] font-semibold leading-none">{operation.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-[18px] font-semibold text-slate-950" htmlFor="big-number-expression">
                  Expression
                </label>
                <div className="mt-3 rounded-[20px] border-2 border-slate-200 bg-white p-3 focus-within:border-sky-400 focus-within:shadow-[0_0_0_4px_rgba(56,189,248,0.18)]">
                  <textarea
                    id="big-number-expression"
                    value={expression}
                    className="min-h-[80px] w-full resize-none border-0 bg-transparent px-3 py-2 text-[22px] leading-9 text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="Enter an expression, for example 2^0xff+4*1000000000000000000+3^19%97"
                    onChange={(event) => {
                      setExpression(event.target.value);
                      setExpressionSubmitted(false);
                    }}
                    onKeyDown={handleExpressionKeyDown}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" className="h-11 rounded-xl px-5 text-base" onClick={handleClearExpression}>
                    Clear
                  </Button>
                  <Button type="button" className="h-11 rounded-xl px-5 text-base" onClick={handleCalculateExpression}>
                    Calculate
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[18px] font-semibold text-slate-950">Result</h2>
              <div className="flex items-center gap-2">
                <ActionIconButton
                  tooltip={resultBase === 'decimal' ? 'Switch result to hex' : 'Switch result to decimal'}
                  aria-label={resultBase === 'decimal' ? 'Switch result to hex' : 'Switch result to decimal'}
                  className={output.error || !output.value ? 'text-slate-300 hover:text-slate-300' : 'text-slate-400 hover:text-sky-600'}
                  disabled={!!output.error || !output.value}
                  onClick={handleToggleResultBase}
                >
                  <IconArrowsExchange className="size-4" stroke={1.8} />
                </ActionIconButton>
                <ActionIconButton
                  tooltip={copied ? 'Copied' : 'Copy result'}
                  aria-label={copied ? 'Result copied' : 'Copy result'}
                  className={displayedResult.trim() ? 'text-slate-400 hover:text-sky-600' : 'text-slate-300 hover:text-slate-300'}
                  disabled={!displayedResult.trim()}
                  onClick={() => void handleCopy()}
                >
                  <IconCopy className="size-4" stroke={1.8} />
                </ActionIconButton>
              </div>
            </div>

            <div className={`mt-4 max-h-[260px] overflow-auto rounded-xl border px-5 py-4 ${output.error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-900'}`}>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[18px] leading-8">{displayedResult || ''}</pre>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
