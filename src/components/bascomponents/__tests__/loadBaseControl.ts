import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { compileScript, parse } from 'vue/compiler-sfc';
import { ModuleKind, transpileModule } from 'typescript';

export async function baseControlUrl(name: string): Promise<string> {
    const source = await readFile(new URL(`../${name}.vue`, import.meta.url), 'utf8');
    const { descriptor } = parse(source);
    const script = compileScript(descriptor, { id: name, inlineTemplate: true }).content;
    const compiled = transpileModule(script, { compilerOptions: { module: ModuleKind.ESNext } }).outputText
        .replaceAll(/import ['"][^'"]+\.css['"];?/g, '')
        .replaceAll(/(['"])vue\1/g, JSON.stringify(import.meta.resolve('vue')));
    return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
}
