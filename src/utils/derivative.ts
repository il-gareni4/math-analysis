import {all, create, MathNode} from "mathjs";
import {convertLatexToAsciiMath} from 'mathlive'
import {EStep, StepProp, tableDerivations} from "@/config/steps";

const isOperatorNode = (node: any): boolean => 'fn' in node;
const isSymbolNode = (node: any): boolean => 'name' in node && !isOperatorNode(node);
const isExp = (node: any): boolean => isSymbolNode(node) && node.name === 'e';
const isParenthesisNode = (node: any): boolean => 'content' in node;
const isConstantNode = (node: any): boolean => {
  node = isParenthesisNode(node) ? node.content : node
  return 'value' in node || (node.args && (isConstantNode(node.args[0]) && isConstantNode(node.args[1])))
};
const isParam = (node: any, param: string): boolean => {
  node = isParenthesisNode(node) ? node.content : node
  return isSymbolNode(node) && node.name === param;
}


function derivativePow(degree: number, param: string): string {
  return `${degree} * ${param}^${degree - 1}`
}

function derivativePowFormula(degree: number, param: string): string {
  return `${degree}\\cdot ${param}^${degree - 1}`
}

function derivativeSqrt(param: string): string {
  return `1 / (2*sqrt(${param}))`
}

function derivativeSqrtFormula(param: string): string {
  return `\\frac{1}{(2\\cdot\\sqrt{${param}})}`
}

function derivativeDivide(div: number, param: string): string {
  return `-(${div}/${param}^2)`
}

function derivativeDivideFormula(div: number, param: string): string {
  return `-\\frac{${div}}{${param}^2}`
}

function getParam(param: string) {
  const params: string[] = ['x', 'z', 't','g']
  const paramIndex = params.indexOf(param)
  return params[(paramIndex === -1 || paramIndex === (params.length - 1)) ? 0 : paramIndex + 1]
}

function getConstant(node: any) {
  let val = 0
  if (isParenthesisNode(node)) {
    const content = node.content
    if ('args' in content) {
      switch (content.op) {
        case '/':
          val = getConstant(content.args[0]) / getConstant(content.args[1])
          break
        case '*':
          val = getConstant(content.args[0]) * getConstant(content.args[1])
          break
      }
    } else if ('value' in content) {
      val = content.value
    }
  } else {
    val = node.value
  }
  return val
}

export function derivative(func: string, param: string, steps: StepProp[]): string {
  const mathjs = create(all);
  let res = ''
  let f = convertLatexToAsciiMath(func)
  f = f.replaceAll('⋅', '*').replaceAll(' ', '')
  if (f.includes('ln')) {
    f = f.replaceAll('ln', 'log')
  }
  if (f.includes('∗')) {
    f = f.replaceAll('∗', '*')
  }
  console.log(f)
  const tree: MathNode = mathjs.parse(f)
  console.log(tree)
  let step: StepProp
  let z: string
  const paramName = getParam(param)

  if (isOperatorNode(tree)) {
    const [arg1, arg2] = tree.args
    const func = tree.fn.name || tree.fn
    switch (func) {
      case 'pow':
        if (isParam(arg1, param)) {
          const val = getConstant(arg2)
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = ${derivativePowFormula(val, arg1.toString())}`,
            tableDerivative: tableDerivations.pow
          }
          steps.push(step)
          if (isConstantNode(arg2)) {
            res += derivativePow(val, param)
          } else if (isParenthesisNode(arg2)) {
            if (isConstantNode(arg2.content)) {
              const val = getConstant(arg2)
              res += `${derivativePow(val, arg1.toString())}`
            }
          }
        } else if (isParenthesisNode(arg1)) {
          z = arg1.toTex()
          step = {
            step: EStep.Difficult,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime}\\cdot \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime},\\thinspace где\\thinspace ${paramName} = ${z}`,
          }
          steps.push(step)
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime} = ${derivativePowFormula(arg2.value, arg1.toTex())},\\thinspace где\\thinspace ${paramName} = ${z}`,
            tableDerivative: tableDerivations.pow
          }
          steps.push(step)
          res += `${derivativePow(arg2.value, arg1.toString())} * (${derivative(arg1.content.toString(), param, steps)})`
        } else if (isConstantNode(arg1)) {

          res += `${arg1.value}^${arg2.toString()} * ln(${arg1.value})`
          if (isParenthesisNode(arg2)) {
            z = arg2.content.toTex()
            step = {
              step: EStep.Difficult,
              formula: `\\left({${arg1.value}^{${arg2.content.toTex()}}}\\right)_{${param}}^{\\prime} = \\left({${arg1.value}^{${arg2.content.toTex()}}}\\right)_{${paramName}}^{\\prime}\\cdot {${arg2.content.toString()}}_{${param}}^{\\prime},\\thinspace где\\thinspace ${paramName} = ${z}`,
            }
            steps.push(step)
            res += `* ${derivative(arg2.toString(), param, steps)}`
          }
          console.log('arg2', arg2)
          step = {
            step: EStep.Table,
            formula: `\\left({${arg1.value}^{${arg2.content?.toTex() || arg2.toTex()}}}\\right)_{${isParenthesisNode(arg2) ? paramName: param}}^{\\prime} = {${arg1.value}^{${arg2.content?.toTex() || arg2.toTex()}}}\\cdot ln{${arg1.value}}${isParenthesisNode(arg2) ? `,\\thinspace где\\thinspace ${paramName} = ${z}` : ''}`,
            tableDerivative: tableDerivations.exp
          }
          steps.push(step)
        } else if (isSymbolNode(arg1) && isConstantNode(arg2)) {
          res += tree.toString()
        } else if (isSymbolNode(arg1)) {
          res += `${arg1.name}^${arg2.toString()}${isExp(arg1) ? '' : `* ln(${arg1.name})`}`
          console.log(res)
          if (isParenthesisNode(arg2)) {
            z = arg2.content.toTex()
            step = {
              step: EStep.Difficult,
              formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime}\\cdot \\left({${arg2.content.toTex()}}\\right)_{${param}}^{\\prime},\\thinspace где\\thinspace ${paramName} = ${z}`,
            }
            steps.push(step)
            res += `* ${derivative(arg2.toString(), param, steps)}`
          }
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${isParenthesisNode(arg2) ? paramName : param}}^{\\prime} = {${arg1.toTex()}^{${arg2.toTex()}}}${isExp(arg1) ? '' : `\\cdot ln{${arg1.value}}`}${isParenthesisNode(arg2) ? `,\\thinspace где\\thinspace ${paramName} = ${z}`: ''}`,
            tableDerivative: isExp(arg1) ? tableDerivations.expE : tableDerivations.exp
          }
          steps.push(step)
        } else if (isOperatorNode(arg1)) {

          z = arg1.toTex()
          step = {
            step: EStep.Difficult,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime}\\cdot ${arg1.toTex()}_{${param}}^{\\prime},\\thinspace где\\thinspace ${paramName} = ${z}`,
          }
          steps.push(step)

          if (isConstantNode(arg2)) {
            step = {
              step: EStep.Table,
              formula: `\\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime} = ${derivativePowFormula(arg2.value, arg1.toTex())},\\thinspace где\\thinspace ${paramName} = ${z}`,
              tableDerivative: tableDerivations.pow
            }
            steps.push(step)
            res += `${derivativePow(arg2.value, arg1.toString())} * (${derivative(arg1.toString(), param, steps)})`
          } else if (isParenthesisNode(arg2) && isConstantNode(arg2.content)) {
            const val = getConstant(arg2)
            step = {
              step: EStep.Table,
              formula: `\\left({${tree.toString()}}\\right)_{${paramName}}^{\\prime} = ${derivativePowFormula(val, arg1.toString())},\\thinspace где\\thinspace ${paramName} = ${z}`,
              tableDerivative: tableDerivations.pow
            }
            steps.push(step)
            res += `${derivativePow(val, arg1.toString())} * (${derivative(arg1.toString(), param, steps)})`
          }
        }
        break
      case 'sqrt':
        if (isParam(arg1, param)) {
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = ${derivativeSqrtFormula(param)}`,
            tableDerivative: tableDerivations.sqrt
          }
          steps.push(step)
          res += derivativeSqrt(param)
        } else if (isOperatorNode(arg1) || isParenthesisNode(arg1)) {

          const currentTree = isParenthesisNode(arg1) ? arg1.content.toString() : arg1.toString()
          z = isParenthesisNode(arg1) ? arg1.content.toTex() : arg1.toTex()
          step = {
            step: EStep.Difficult,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime}= (${tree.toTex()})_{${paramName}}^{\\prime}\\cdot (${arg1.toTex()})_{${param}}^{\\prime}),\\thinspace где\\thinspace ${paramName} = ${z}`,
          }
          steps.push(step)
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime} = ${derivativeSqrtFormula(currentTree)},\\thinspace где\\thinspace ${paramName} = ${z}`,
            tableDerivative: tableDerivations.sqrt
          }
          steps.push(step)
          res += `${derivativeSqrt(currentTree)} * (${derivative(currentTree, param, steps)})`
        }
        break
      case "multiply":
        if (isParam(arg1, param)) {
          if (isConstantNode(arg2)) {
            step = {
              step: EStep.ConstantX,
              formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = ${arg2.value}`,
            }
            steps.push(step)
            res += `${arg2.value}`
          } else if (isOperatorNode(arg2)) {
            step = {
              step: EStep.ConstantX,
              formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = 1\\cdot ${derivative(arg2.toString(), param, steps)}`,
            }
            steps.push(step)
            res += `1 * ${derivative(arg2.toString(), param, steps)}`
          } else if (isSymbolNode(arg2)) {
            step = {
              step: EStep.ConstantX,
              formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = 1\\cdot ${arg2.toTex()}`,
            }
            steps.push(step)
            res += `1 * ${arg2.toString()}`
          }
        } else if (isConstantNode(arg1)) {
          const val = 'args' in arg1 ? `${arg1.args[0]}${arg1.op}${arg1.args[1]}` : arg1.value
          if (isParam(arg2, param)) {
            step = {
              step: EStep.ConstantX,
              formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = ${val}`,
            }
            steps.push(step)
            res += `${val}`
          } else if (isOperatorNode(arg2)) {
            step = {
              step: EStep.ConstantX,
              formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = ${val}\\cdot (${derivative(arg2.toString(), param, steps)})`,
            }
            steps.push(step)
            res += `${val} * (${derivative(arg2.toString(), param, steps)})`
          }
        } else if (isSymbolNode(arg1)) {
          step = {
            step: EStep.ConstantX,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = ${arg1.toTex()}\\cdot (${arg2.toTex()})_{${param}}^{\\prime}`,
          }
          steps.push(step)
          res += `${arg1.toString()} * (${derivative(arg2.toString(), param, steps)})`
        } else if ((isOperatorNode(arg1) || isParenthesisNode(arg1)) && isSymbolNode(arg2)) {
          step = {
            step: EStep.ConstantX,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = ${arg2.toTex()}\\cdot (${arg1.toTex()})_{${param}}^{\\prime}`,
          }
          steps.push(step)
          res += `${arg2.toString()} * (${derivative(arg1.toString(), param, steps)})`
        }  else if ((isOperatorNode(arg1) || isParenthesisNode(arg1)) && (isOperatorNode(arg2) || isParenthesisNode(arg2))) {
          const u = isParenthesisNode(arg1) ? arg1.content.toString() : arg1.toString()
          const uFormula = isParenthesisNode(arg1) ? arg1.content.toTex() : arg1.toTex()
          const v = isParenthesisNode(arg2) ? arg2.content.toString() : arg2.toString()
          const vFormula = isParenthesisNode(arg2) ? arg2.content.toTex() : arg2.toTex()
          console.log(uFormula, vFormula)

          step = {
            step: EStep.Mul,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${uFormula}}\\right)_{${param}}^{\\prime}\\cdot\\left({${vFormula}}\\right) + \\left(${uFormula}\\right)\\cdot\\left({${vFormula}}\\right)`,
          }
          steps.push(step)
          // res += `(${derivative(u, param, steps)})*(${v}) + (${u})*(${derivative(v, param, steps)})`
          res += isParenthesisNode(arg1) ? `(${derivative(u, param, steps)})` : derivative(u, param, steps)
          res += isParenthesisNode(arg2) ? `*(${v})` : `*${v}`
          res += ' + '
          res += isParenthesisNode(arg1) ? `(${u})` : `${u}`
          res += isParenthesisNode(arg2) ? `(${derivative(v, param, steps)})` : derivative(v, param, steps)
        }
        break
      case "divide":
        if (isParam(arg1, param) && isConstantNode(arg2)) {
          const val = getConstant(arg2)
          step = {
            step: EStep.ConstantX,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\frac{1}{${val}}`,
          }
          steps.push(step)
          res += `1/${val}`
        } else if (isConstantNode(arg1) && isParam(arg2, param)) {
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = ${derivativeDivideFormula(arg1.value, param)}`,
            tableDerivative: tableDerivations.pow
          }
          steps.push(step)
          res += derivativeDivide(arg1.value, param)
        } else if ((isParenthesisNode(arg1) && (isConstantNode(arg1.content) || (isSymbolNode(arg1.content) && !isParenthesisNode(arg2))))
          && (isParenthesisNode(arg2) && (isConstantNode(arg2.content) || isSymbolNode(arg2.content)))) {
          const val1 = isConstantNode(arg1.content) ? getConstant(arg1) : arg1.content.name
          const val2 = isConstantNode(arg2.content) ? getConstant(arg2) : arg2.content.name

          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = ${derivativeDivideFormula(val1, val2)}`,
            tableDerivative: tableDerivations.pow
          }
          steps.push(step)
          res += derivativeDivide(val1, val2)
        } else if ((isParam(arg1, param) || isOperatorNode(arg1) || isParenthesisNode(arg1)) && (isOperatorNode(arg2) || isParenthesisNode(arg2))) {
          const u = isParenthesisNode(arg1) ? arg1.content.toString() : arg1.toString()
          const uFormula = isParenthesisNode(arg1) ? arg1.content.toTex() : arg1.toTex()
          const v = isParenthesisNode(arg2) ? arg2.content.toString() : arg2.toString()
          const vFormula = isParenthesisNode(arg2) ? arg2.content.toTex() : arg2.toTex()
          step = {
            step: EStep.Div,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\frac{\\left(${uFormula}\\right)_{${param}}^{\\prime}\\cdot \\left({${vFormula}}\\right) - \\left({${uFormula}}\\right)\\cdot\\left({${vFormula}}\\right)_{${param}}^{\\prime}}{\\left({${vFormula}}\\right)^{2}}`,
          }
          steps.push(step)
          res += '('
          res += isParenthesisNode(arg1) ? `(${derivative(u, param, steps)})` : derivative(u, param, steps)
          res += isParenthesisNode(arg2) ? `*(${v})` : `*${v}`
          res += ' - '
          res += isParenthesisNode(arg1) ? `(${u})*` : `${u}*`
          res += isParenthesisNode(arg2) ? `(${derivative(v, param, steps)})` : derivative(v, param, steps)
          res += ')'
          res += isParenthesisNode(arg2) ? `/${v}^2` : `/(${v})^2`
          console.log(res)
        } else if (isConstantNode(arg1) && isConstantNode(arg2)) {
          console.log(arg1.value, arg2.value)
          res += `${arg1.value} / ${arg2.value}`
        }
        break
      case "add":
        step = {
          step: EStep.AddOrSub,
          formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime} + \\left({${arg2.toTex()}}\\right)_{${param}}^{\\prime}`
        }
        steps.push(step)
        res += `${derivative(arg1.toString(), param, steps)} + ${derivative(arg2.toString(), param, steps)}`
        break
      case "subtract":
        step = {
          step: EStep.AddOrSub,
          formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime} - \\left({${arg2.toTex()}}\\right)_{${param}}^{\\prime}`
        }
        steps.push(step)
        res += `${derivative(arg1.toString(), param, steps)} - (${derivative(arg2.toString(), param, steps)})`
        break
      case "log":
        if (arg2) {
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\frac{1}{${isParam(arg1, param) ? param : arg1.toTex()}\\cdot\\ln{${arg2.value}}}`,
            tableDerivative: tableDerivations.log
          }
          steps.push(step)
          if (isConstantNode(arg2)) {
            res += `1/(${isParam(arg1, param) ? param : arg1.toString()}*ln(${arg2.value})) ${isParam(arg1, param) ? '' : `* (${derivative(arg1.toString(), param, steps)})`}`
          } else if (isSymbolNode(arg2)) {
            if (arg2.name === 'e') {
              res += `1/${isParam(arg1, param) ? param : arg1.toString()} ${isParam(arg1, param) ? '' : `* (${derivative(arg1.toString(), param, steps)})`}`
            } else {
              res += `1/(${isParam(arg1, param) ? param : arg1.toString()}*ln(${arg2.name})) ${isParam(arg1, param) ? '' : `* (${derivative(arg1.toString(), param, steps)})`}`
            }
          }
        } else {
          console.log('arg1', arg1)
          z = arg1.toTex()
          if (!isParam(arg1, param)) {
            step = {
              step: EStep.Difficult,
              formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime}\\cdot \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime},\\thinspace где\\thinspace ${paramName} = ${z}`,
            }
            steps.push(step)
          }
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${isParam(arg1, param) ? param : paramName}}^{\\prime} = \\frac{1}{\\ln\\left({${isParam(arg1, param) ? param : arg1.toTex()}}\\right)}${isParam(arg1, param) ? '' : `,\\thinspace где\\thinspace ${paramName} = ${z}`}`,
            tableDerivative: tableDerivations.ln
          }
          steps.push(step)
          res += `1/(${isParam(arg1, param) ? param : arg1.toString()}) ${isParam(arg1, param) ? '' : `* (${derivative(arg1.toString(), param, steps)})`}`
        }
        break
      case "sin":
        if (isParam(arg1, param)) {
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\cos\\left({${arg1.toString()}}\\right)`,
            tableDerivative: tableDerivations.sin
          }
          steps.push(step)
          res += `cos(${arg1.toString()})`
        } else if (isOperatorNode(arg1)) {
          z = arg1.toTex()
          step = {
            step: EStep.Difficult,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime}\\cdot \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime},\\thinspace где\\thinspace ${paramName} = ${z}`,
          }
          steps.push(step)
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime} = \\cos\\left({${arg1.toString()}}\\right),\\thinspace где\\thinspace ${paramName} = ${z}`,
            tableDerivative: tableDerivations.sin
          }
          steps.push(step)
          res += `cos(${arg1.toString()}) * (${derivative(arg1.toString(), param, steps)})`
        }
        break
      case "cos":
        if (isParam(arg1, param)) {
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = -\\sin\\left({${arg1.toTex()}}\\right)`,
            tableDerivative: tableDerivations.cos
          }
          steps.push(step)
          res += `-sin(${arg1.toString()})`
        } else if (isOperatorNode(arg1)) {
          z = arg1.toTex()
          step = {
            step: EStep.Difficult,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime}\\cdot \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime},\\thinspace где\\thinspace ${paramName} = ${z}`,
          }
          steps.push(step)
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime} = -\\sin\\left({${arg1.toTex()}}\\right),\\thinspace где\\thinspace ${paramName} = ${z}`,
            tableDerivative: tableDerivations.cos
          }
          steps.push(step)
          res += `-sin(${arg1.toString()}) * (${derivative(arg1.toTex(), param, steps)})`
        }
        break
      case "tg":
        if (isParam(arg1, param)) {
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\frac{1}{{\\cos^2{(${arg1.toTex()})}}}`,
            tableDerivative: tableDerivations.tg
          }
          steps.push(step)
          res += `1/(cos(${arg1.toString()})^2)`
        } else if (isOperatorNode(arg1)) {
          z = arg1.toTex()
          step = {
            step: EStep.Difficult,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime}\\cdot \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime},\\thinspace где\\thinspace ${paramName} = ${z}`,
          }
          steps.push(step)
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime} = \\frac{1}{{\\cos^2{(${arg1.toTex()})}}},\\thinspace где\\thinspace ${paramName} = ${z}`,
            tableDerivative: tableDerivations.tg
          }
          steps.push(step)
          res += `1/(cos(${arg1.toString()})^2) * (${derivative(arg1.toString(), param, steps)})`
        }
        break
      case "ctg":
        if (isParam(arg1, param)) {
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\frac{1}{{\\cos^2{(${arg1.toTex()})}}}`,
            tableDerivative: tableDerivations.ctg
          }
          steps.push(step)
          res += `-1/(sin(${arg1.toString()})^2)`
        } else if (isOperatorNode(arg1)) {
          z = arg1.toTex()
          step = {
            step: EStep.Difficult,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime}\\cdot \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime},\\thinspace где\\thinspace ${paramName} = ${z}`,
          }
          steps.push(step)
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime} = \\frac{1}{{\\cos^2{(${arg1.toTex()})}}},\\thinspace где\\thinspace ${paramName} = ${z}`,
            tableDerivative: tableDerivations.ctg
          }
          steps.push(step)
          res += `-1/(sin(${arg1.toString()})^2) * (${derivative(arg1.toString(), param, steps)})`
        }
        break
      case "arcsin":
        if (isParam(arg1, param)) {
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\frac{1}{\\sqrt{1-{\\left(${arg1.toString()}\\right)}^2}}`,
            tableDerivative: tableDerivations.arcsin
          }
          steps.push(step)
          res += `1/sqrt(1-(${arg1.toString()})^2)`
        } else if (isOperatorNode(arg1)) {
          z = arg1.toTex()
          step = {
            step: EStep.Difficult,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime}\\cdot \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime},\\thinspace где\\thinspace ${paramName} = ${z}`,
          }
          steps.push(step)
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime} = \\frac{1}{\\sqrt{1-{\\left(${arg1.toString()}\\right)}^2}},\\thinspace где\\thinspace ${paramName} = ${z}`,
            tableDerivative: tableDerivations.arcsin
          }
          steps.push(step)
          res += `1/sqrt(1-(${arg1.toString()})^2) * (${derivative(arg1.toString(), param, steps)})`
        }
        break
      case "arccos":
        if (isParam(arg1, param)) {
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = -\\frac{1}{\\sqrt{(1-{\\left(${arg1.toString()}\\right)}^2)}}`,
            tableDerivative: tableDerivations.arccos
          }
          steps.push(step)
          res += `-1/sqrt(1-(${arg1.toString()})^2)`
        } else if (isOperatorNode(arg1)) {
          z = arg1.toTex()

          step = {
            step: EStep.Difficult,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime}\\cdot \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime},\\thinspace где\\thinspace ${paramName} = ${z}`,
          }
          steps.push(step)
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime} = -\\frac{1}{\\sqrt{(1-{\\left(${arg1.toString()}\\right)}^2)}},\\thinspace где\\thinspace ${paramName} = ${z}`,
            tableDerivative: tableDerivations.arccos
          }
          steps.push(step)
          res += `-1/sqrt(1-(${arg1.toString()})^2) * (${derivative(arg1.toString(), param, steps)})`
        }
        break
      case "arctg":
        if (isParam(arg1, param)) {
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\frac{1}{(1+{\\left(${arg1.toString()}\\right)}^2}`,
            tableDerivative: tableDerivations.arctg
          }
          steps.push(step)
          res += `1/(1+(${arg1.toString()})^2)`
        } else if (isOperatorNode(arg1)) {
          z = arg1.toTex()
          step = {
            step: EStep.Difficult,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime}\\cdot \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime},\\thinspace где\\thinspace ${paramName} = ${z}`,
          }
          steps.push(step)
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime} = \\frac{1}{(1+{\\left(${arg1.toString()}\\right)}^2},\\thinspace где\\thinspace ${paramName} = ${z}`,
            tableDerivative: tableDerivations.arctg
          }
          steps.push(step)
          res += `1/(1+(${arg1.toString()})^2) * (${derivative(arg1.toString(), param, steps)})`
        }
        break
      case "arcctg":
        if (isParam(arg1, param)) {
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = -\\frac{1}{(1+{\\left(${arg1.toString()}\\right)}^2}`,
            tableDerivative: tableDerivations.arcctg
          }
          steps.push(step)
          res += `-1/(1+(${arg1.toString()})^2)`
        } else if (isOperatorNode(arg1)) {
          z = arg1.toTex()
          step = {
            step: EStep.Difficult,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime}\\cdot \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime},\\thinspace где\\thinspace ${paramName} = ${z}`,
          }
          steps.push(step)
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${paramName}}^{\\prime} = -\\frac{1}{(1+{\\left(${arg1.toString()}\\right)}^2},\\thinspace где\\thinspace ${paramName} = ${z}`,
            tableDerivative: tableDerivations.arcctg
          }
          steps.push(step)
          res += `-1/(1+(${arg1.toString()})^2) * (${derivative(arg1.toString(), param, steps)})`
        }
        break
      case "sh":
        if (isParam(arg1, param)) {
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\ch\\left({${arg1.toString()}}\\right)`,
            tableDerivative: tableDerivations.sh
          }
          steps.push(step)
          res += `ch(${arg1.toString()})`
        } else if (isOperatorNode(arg1)) {
          step = {
            step: EStep.Difficult,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${param}}^{\\prime}\\cdot \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime}`,
          }
          steps.push(step)
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\ch\\left({${arg1.toString()}}\\right)`,
            tableDerivative: tableDerivations.sh
          }
          steps.push(step)
          res += `ch(${arg1.toString()}) * (${derivative(arg1.toString(), param, steps)})`
        }
        break
      case "ch":
        if (isParam(arg1, param)) {
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = -\\sh\\left({${arg1.toString()}}\\right)`,
            tableDerivative: tableDerivations.ch
          }
          steps.push(step)
          res += `-sh(${arg1.toString()})`
        } else if (isOperatorNode(arg1)) {

          step = {
            step: EStep.Difficult,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${param}}^{\\prime}\\cdot \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime}`,
          }
          steps.push(step)
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = -\\sh\\left({${arg1.toString()}}\\right)`,
            tableDerivative: tableDerivations.ch
          }
          steps.push(step)
          res += `-sh(${arg1.toString()}) * (${derivative(arg1.toString(), param, steps)})`
        }
        break
      case "th":
        if (isParam(arg1, param)) {
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\frac{1}{{\\ch^2{(${arg1.toTex()})}}}`,
            tableDerivative: tableDerivations.th
          }
          steps.push(step)
          res += `1/(ch(${arg1.toString()})^2)`
        } else if (isOperatorNode(arg1)) {
          step = {
            step: EStep.Difficult,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${param}}^{\\prime}\\cdot \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime}`,
          }
          steps.push(step)
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\frac{1}{{\\ch^2{(${arg1.toTex()})}}}`,
            tableDerivative: tableDerivations.th
          }
          steps.push(step)
          res += `1/(ch(${arg1.toString()})^2) * (${derivative(arg1.toString(), param, steps)})`
        }
        break
      case "cth":
        if (isParam(arg1, param)) {
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\frac{1}{{\\sh^2{(${arg1.toTex()})}}}`,
            tableDerivative: tableDerivations.cth
          }
          steps.push(step)
          res += `-1/(sh(${arg1.toString()})^2)`
        } else if (isOperatorNode(arg1)) {
          step = {
            step: EStep.Difficult,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\left({${tree.toTex()}}\\right)_{${param}}^{\\prime}\\cdot \\left({${arg1.toTex()}}\\right)_{${param}}^{\\prime}`,
          }
          steps.push(step)
          step = {
            step: EStep.Table,
            formula: `\\left({${tree.toTex()}}\\right)_{${param}}^{\\prime} = \\frac{1}{{\\sh^2{(${arg1.toTex()})}}}`,
            tableDerivative: tableDerivations.cth
          }
          steps.push(step)
          res += `-1/(sh(${arg1.toString()})^2) * (${derivative(arg1.toString(), param, steps)})`
        }
        break
    }
  } else if (isParenthesisNode(tree)) {
    res += `(${derivative(tree.content.toString(), param, steps)})`
  } else if (isSymbolNode(tree)) {

    step = {
      step: EStep.Table,
      formula: `(${tree.toString()})'_x = 1`,
      tableDerivative: tableDerivations.x
    }
    steps.push(step)
    res = '1'
  } else if (isConstantNode(tree)) {
    step = {
      step: EStep.Const,
      formula: `(${tree.toString()})'_x = 0`,
    }
    steps.push(step)
    res = '0';
  }
  return res
}
