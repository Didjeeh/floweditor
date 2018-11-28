'use strict';
//#region fields
const columnClasses = { wide: 'col-lg-12', narrow: 'col-lg-8', veryNarrow: 'col-lg-8' };
const editStates = { graph: 1, help: 2 };
const maxPercentSvgWidth = 91.3;
const loadingDefinition = `a((L))
b(o)
c[a]
d{d}
e[i]
f(n)
g((g))`;

let simplemde;

let delayRenderingTimeout;
let wasEditPaneFirstTimeVisible = false;
let graphDivColumnClass = columnClasses.wide;
let originalSvgWidth;
let editState = editStates.graph;
let errorText = '';
let isEditPaneVisible = false;

let definition = `a((E)) --> b(x) 
b --> c{a}
c -- yes --> d1(m)
c -- no --> d2(p)
d1 --> e(l)
d2 --> e
e --> f[e]`;
let help = `a:
This example links help to a node ID *a*. The node text is always the title of a help section.

Define nodes in *Definition*. This definition is a subset of what is described [here](https://mermaidjs.github.io/flowchart.html).

Click a node in the flow to see the result.

b:
Go ahead, play around with the editor! Be sure to check out **bold** and *italic* styling, or even [links](https://google.com). You can type the Markdown syntax, use the toolbar, or use shortcuts like \`cmd-b\` or \`ctrl-b\`.

## Lists
Unordered lists can be started using the toolbar or by typing \`* \`, \`- \`, or \`+ \`. Ordered lists can be started by typing \`1. \`.

### Unordered
* Lists are a piece of cake
* They even auto continue as you type
* A double enter will end them
* Tabs and shift-tabs work too

### Ordered
1. Numbered lists...
2. ...work too!

## What about images?
![Yes](https://i.imgur.com/sZlktY7.png)

*Source: <https://simplemde.com/>*

d: When there is **no** help available for specific elements in a layer (*d1(m)* and *d2(p)* in layer *d*), the **layer-wise help** is shown, if any.`;
let htmlHelp = {};
//#endregion

const findLayerName = (nodeId) => {
    let layerIdLength = nodeId.length;
    for (let i = nodeId.length - 1; i != -1; i--) {
        if (isNaN(nodeId[i])) {
            break;
        }
        layerIdLength--;
    }
    return nodeId.substring(0, layerIdLength);
};

// To make sure node Ids follow correct naming conventions. Not yet implemented.
/*
const cleanupNodeIds = () => {
    $('#graph-diagram .nodes .node').each(function (index) {
    });
    renderGraph();
};
*/

//#region rendering
const preProcessGraph = (s) => {
    let element = document.createElement('div');
    element.className = 'mermaid-graph';

    s = s.trim();

    // Strip script/html tags.
    s = s.replace(/<script[^>]*>([\S\s]*?)<\/script>/gim, '');
    s = s.replace(/<\/?\w(?:[^''>]|'[^']*'|'[^']*')*>/gim, '');
    element.innerHTML = s;
    s = element.textContent;
    element.textContent = '';

    if (!s.startsWith('graph ')) {
        s = 'graph TD\n' + s;
    }

    return s;
};
// Post process.
const fixGraphDivDimensions = () => {
    let graph = $('#graph-div')[0];
    let svg = graph.children[0];
    originalSvgWidth = svg.clientWidth;
    let widthPercent = 100 * originalSvgWidth / graph.getBoundingClientRect().width;

    if (widthPercent > maxPercentSvgWidth) {
        $(svg).attr('style', `max-width: ${maxPercentSvgWidth}%;`);
    }
    $(svg).removeAttr('height');
};
// Post process.
const fillHtmlHelp = () => {
    let split = help.split(/[\n\r]/g);
    htmlHelp = {};
    for (let i = 0; i != split.length; i++) {
        let kvpCandidate = split[i];
        if (kvpCandidate) {
            kvpCandidate = kvpCandidate.trim();
        }

        let keys = Object.keys(htmlHelp);
        //Search first index of one or more numbers or letters followed by a :.
        let objectSignatureIndex = kvpCandidate.search(/[a-zA-Z0-9_.-]+\:/);
        if (objectSignatureIndex === 0) {
            let indexOfSplitter = kvpCandidate.indexOf(':');

            let key = kvpCandidate.substring(0, indexOfSplitter).trim();
            let value = kvpCandidate.substring(key.length + 1).trim();
            if (!value) {
                value = '\n\n';
            }

            htmlHelp[key] = value;
        }
        else {
            if (keys.length === 0) {
                continue;
            }

            let prevVal = htmlHelp[keys[keys.length - 1]];
            kvpCandidate = kvpCandidate.trim();
            if (!kvpCandidate) {
                kvpCandidate = '\n\n';
            }
            prevVal += '\n\n' + kvpCandidate;
            htmlHelp[keys[keys.length - 1]] = prevVal;
        }
    }
};
// Post process.
const bindNodeClick = () => {
    $('#graph-diagram .nodes .node').click(function () {
        let nodeId = $(this).attr('id');
        let nodeHelp = htmlHelp[nodeId];
        if (!nodeHelp) {
            nodeHelp = htmlHelp[findLayerName(nodeId)];
        }

        if (nodeHelp === undefined) {
            nodeHelp = '';
        }
        else {
            nodeHelp = '<div>' + marked(nodeHelp) + '</div>';
        }

        nodeHelp = '<h2>' + $(this)[0].textContent + '</h2>' + nodeHelp;

        $('#help-pane').html(nodeHelp);
        $('#graph-div').hide();
        $('#save-btn').hide();
        $('#open-file').hide();
        $('#edit-btn').hide();
        $('#edit-pane').hide();
        $('#help-pane').fadeIn();
        $('#close-help-btn').show();
    });
};
// Renders the graph svg from Definition and links the help to the nodes. 
const renderGraph = () => {
    try {
        let graphDefinition = preProcessGraph(definition);
        errorText = '';

        $('#graph-parse-error').hide();
        $('#graph-parse-error').html('');

        mermaid.parseError = (err) => {
            console.error(err);
            let split = err.split(/[\n\r]/g);
            split = split.slice(0, 2);
            errorText = split.join('<br>');

            $('#graph-parse-error').html(errorText);
        }

        if (mermaid.parse(graphDefinition)) {
            try {
                $('#graph-div').remove();
            } catch (e) { }
            mermaidAPI.initialize({
                logLevel: 3,
                startOnLoad: false
            });

            //Do not render empty definitions.
            if (definition) {
                mermaidAPI.render('graph-diagram', graphDefinition, function (svgCode) {
                    let graph = document.createElement('div');
                    graph.className = graphDivColumnClass;
                    graph.setAttribute('id', 'graph-div');
                    $('#container').children()[0].prepend(graph);

                    graph.innerHTML = svgCode;

                    fixGraphDivDimensions();
                    fillHtmlHelp();
                    bindNodeClick();
                });
            }
        }
        else {
            if (errorText && editState === editStates.graph) {
                $('#graph-parse-error').show();
            }
        }
    } catch (e) {
        console.error('renderGraph' + e);
    }
};
const delayRenderGraph = () => {
    if (editState === editStates.graph) {
        definition = simplemde.value();
    }
    else {
        help = simplemde.value();
    }

    clearTimeout(delayRenderingTimeout);
    delayRenderingTimeout = setTimeout(renderGraph, 200);
};
//#endregion

//#region menu
const openFileChange = (e) => {
    let f = e.target.files[0];
    if (f) {
        $('#open-file').prop('disabled', true);
        $('#other-controls').hide();
        if (isEditPaneVisible) {
            $('#edit-btn').trigger('click');
        }

        definition = loadingDefinition;

        renderGraph();

        let r = new FileReader();
        r.onload = () => {
            let Uints = new Uint8Array(r.result);
            let db = new SQL.Database(Uints);

            let content = db.exec('SELECT * FROM flow;');
            let row = content[0].values;
            definition = row[0][0];
            help = row[0][1];

            simplemde.codemirror.off("changes", delayRenderGraph);

            simplemde.value(editState === editStates.graph ? definition : help);
            simplemde.codemirror.refresh(); // Force refresh.

            simplemde.codemirror.on("changes", delayRenderGraph);

            renderGraph();

            simplemde.codemirror.refresh(); // Force refresh.

            $('#open-file').prop('disabled', false);
            $('#other-controls').fadeIn();
        }
        r.readAsArrayBuffer(f);
    }
};
const saveBtnClick = () => {
    if (errorText.length != 0 && !confirm('Are you sure that you want to save a flow containing errors?')) {
        return;
    }

    let db = new SQL.Database();
    db.run('CREATE TABLE flow (definition, help);');
    db.run('INSERT INTO flow VALUES (?,?)', [definition, help]);
    let blob = new Blob([db.export()], { type: 'application/octet-stream' });
    saveAs(blob, 'db.sqlite3');
};
const editBtnClick = () => {
    if ($('#edit-pane').attr('style').indexOf('display: none') === -1) {
        graphDivColumnClass = columnClasses.wide;
        isEditPaneVisible = false;
    }
    else {
        graphDivColumnClass = columnClasses.narrow;
        isEditPaneVisible = true;
    }
    $('#edit-pane').toggle();

    if (!wasEditPaneFirstTimeVisible) {
        wasEditPaneFirstTimeVisible = true;
        simplemde.value(definition);
        simplemde.codemirror.refresh(); // Force refresh.
    }
    $('#graph-div')[0].className = graphDivColumnClass;
    fixGraphDivDimensions();
};
const closeHelpBtnClick = () => {
    $('#close-help-btn').hide();
    $('#edit-btn').show();
    $('#save-btn').show();
    $('#open-file').show();
    $('#help-pane').hide();

    if (isEditPaneVisible) {
        $('#edit-btn').trigger('click');
    }
    else {
        graphDivColumnClass = columnClasses.wide;
        $('#graph-div')[0].className = graphDivColumnClass;
        fixGraphDivDimensions();
    }
    $('#graph-div').show();
};
const definitionBtnChange = () => {
    editState = editStates.graph;
    $("#graph-txt-wrapper .editor-toolbar").hide();
    simplemde.value(definition);
    simplemde.codemirror.refresh(); // Force refresh.
};
const helpBtnChange = () => {
    editState = editStates.help;
    $("#graph-txt-wrapper .editor-toolbar").show();
    simplemde.value(help);
    simplemde.codemirror.refresh();  // Force refresh.
};
//#endregion

const main = () => {
    $('#open-file').change(openFileChange);
    $('#save-btn').click(saveBtnClick);
    $('#edit-btn').click(editBtnClick);
    $('#close-help-btn').click(closeHelpBtnClick);
    $('#definition-btn').change(definitionBtnChange);
    $('#help-btn').change(helpBtnChange);
    //$('#cleanup-btn').click(cleanupNodeIds);

    simplemde = new SimpleMDE({ element: $("#graph-txt")[0], spellChecker: false });
    //Following gives Uncaught TypeError.  https://github.com/sparksuite/simplemde-markdown-editor/issues #727 
    //simplemde.codemirror.options.lineNumbers = true;

    $("#graph-txt-wrapper .editor-toolbar").hide();
    simplemde.codemirror.on("changes", delayRenderGraph);
    

    renderGraph();
}

$(document).ready(main);