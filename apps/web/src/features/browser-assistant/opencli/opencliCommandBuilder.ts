// 简体中文：强类型拼装 CDP 操作命令对象
export interface OcliCommand {
  action: 'open' | 'click' | 'type' | 'fill' | 'select' | 'extract' | 'screenshot' | 'network' | 'state';
  target: string;
  payload?: Record<string, any>;
}

export class OpencliCommandBuilder {
  public buildOpen(url: string): OcliCommand {
    return { action: 'open', target: url };
  }

  public buildClick(selector: string): OcliCommand {
    return { action: 'click', target: selector };
  }

  public buildType(selector: string, text: string): OcliCommand {
    return { action: 'type', target: selector, payload: { text } };
  }

  public buildExtract(selector: string, properties: string[]): OcliCommand {
    return { action: 'extract', target: selector, payload: { properties } };
  }

  public buildScreenshot(target: string = 'viewport'): OcliCommand {
    return { action: 'screenshot', target };
  }
}

export const opencliCommandBuilder = new OpencliCommandBuilder();
