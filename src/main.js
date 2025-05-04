import './wasm_exec.js';

window.require.config({ paths: { vs: 'https://unpkg.com/monaco-editor@0.45.0/min/vs' } });

window.require(['vs/editor/editor.main'], () => {
    const editor = monaco.editor.create(document.getElementById('editor'), {
        language: 'godel',
        value: `int INFINITY = 1000000;

struct Edge {
    int target;
    int weight;
}

int[] dijkstra(int numNodes, Edge[][] adjList, int startNode) {
    int[] dist = [INFINITY; numNodes];
    bool[] visited = [false; numNodes];

    dist[startNode] = 0;

    for (int count = 0; count < numNodes - 1; ++count) {
        int minDist = INFINITY;
        int u = -1;
        for (int v = 0; v < numNodes; ++v) {
            if (!visited[v] && dist[v] < minDist) {
                minDist = dist[v];
                u = v;
            }
        }

        if (u == -1) {
            break;
        }

        visited[u] = true;

        for (Edge edge : adjList[u]) {
            int v = edge.target;
            int weight = edge.weight;
            if (!visited[v] && dist[u] != INFINITY && dist[u] + weight < dist[v]) {
                dist[v] = dist[u] + weight;
            }
        }
    }
    return dist;
}

void main() {
    int numNodes = 5;

    Edge[][] adjList = [
        [ Edge { target: 1, weight: 10 }, Edge { target: 4, weight: 5 } ],
        [ Edge { target: 2, weight: 1 }, Edge { target: 4, weight: 2 } ],
        [ Edge { target: 3, weight: 4 } ],
        [ Edge { target: 2, weight: 6 }, Edge { target: 0, weight: 7 } ],
        [ Edge { target: 1, weight: 3 }, Edge { target: 2, weight: 9 }, Edge { target: 3, weight: 2 } ]
    ];

    int startNode = 0;
    int[] shortestDistances = dijkstra(numNodes, adjList, startNode);
    debug("Shortest distances from node", startNode);

    for (int i = 0; i < numNodes; ++i) {
        debug("Node", i, ":");

        if (shortestDistances[i] == INFINITY) {
            debug("Infinity");
        } else {
            debug(shortestDistances[i]);
        }
    }
}`,
        theme: 'vs-dark',
    });

    monaco.languages.register({ id: 'godel' });

    monaco.languages.setMonarchTokensProvider('godel', {
        keywords: [
            'struct', 'if', 'else', 'for', 'while', 'return', 'match',
            'break', 'continue', 'true', 'false', 'int',
            'void', 'int', 'bool', 'char', 'float',
        ],

        operators: [
            '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=',
            '+', '-', '*', '/', '%', '^', '&', '|', '<<', '>>',
            '==', '!=', '<', '<=', '>', '>=', '&&', '||',
            '!', '--', '++', '~', '?', ':',
        ],

        symbols: /[=><!~?:&|+\-*\/\^%]+/,

        tokenizer: {
            root: [
                // identifiers and keywords
                [/[a-zA-Z_][a-zA-Z0-9_]*/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@default': 'identifier',
                    }
                }],

                // whitespace
                { include: '@whitespace' },

                // numbers
                [/\d+\.\d+([eE][-+]?\d+)?/, 'number.float'],
                [/\d+/, 'number'],

                // characters and strings
                [/'([^'\\]|\\.)'/, 'string'],
                [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],

                // operators
                [/@symbols/, {
                    cases: {
                        '@operators': 'operator',
                        '@default': ''
                    }
                }],

                // delimiters and brackets
                [/[{}()\[\]]/, '@brackets'],
                [/[,;]/, 'delimiter'],
            ],

            string: [
                [/[^\\"]+/, 'string'],
                [/\\./, 'string.escape'],
                [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
            ],

            whitespace: [
                [/[ \t\r\n]+/, ''],
                [/\/\/.*$/, 'comment'],
                [/\/\*/, { token: 'comment', next: '@comment' }]
            ],

            comment: [
                [/[^/*]+/, 'comment'],
                [/\*\//, { token: 'comment', next: '@pop' }],
                [/./, 'comment']
            ]
        }
    });


    const go = new Go(); // From wasm_exec.js

    WebAssembly.instantiateStreaming(fetch("godel.wasm"), go.importObject)
        .then(result => {
            go.run(result.instance);

            editor.onDidChangeModelContent(() => {
                console.log("Model changed");
                const code = editor.getValue();
                const errors = window.compile(code);
                console.log(errors);
                const markers = [];

                for (let i = 0; i < errors.length; i++) {
                    const err = errors[i];
                    markers.push({
                        severity: monaco.MarkerSeverity.Error,
                        message: err.error,
                        startLineNumber: err.line,
                        startColumn: err.col,
                        endLineNumber: err.endline,
                        endColumn: err.endcol
                    });
                }

                monaco.editor.setModelMarkers(editor.getModel(), 'owner', markers);
            });

            document.getElementById("run-btn").onclick = () => {
                const code = editor.getValue();
                const output = window.run(code); // from main.go
                if (typeof output === 'string') {
                    document.getElementById("output").textContent = output;
                } else {
                    const errors = output.errors;
                    document.getElementById("output").textContent = errors.join("\n");
                }
            };
        });
});
