'use strict';
//#region fields
const alphabet = Array.from(Array(26), (e, i) => String.fromCharCode(i + 97)); // lowercase a..z
const columnClasses = { wide: 'col-lg-12', narrow: 'col-lg-8', veryNarrow: 'col-lg-4' };
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
let windowScrollY = 0;
let currentSelectedNode;

let definition = `%% Hi there! I am a comment. Below a flow crash course.

%% A node in flow is an **ID** + **label** encapsulated by (( )), ( ), [ ], { }.
%% Nodes can be strung together using e.g. -->.
%% For example:

a(( Problem: Out of hamburgers - CLICK ME! )) -- sigh --> b( Step: Get out of chair - CLICK ME TOO ) 

%% When you click "node a" you will see the linked help. Click the **Help** button next to **Definition** to see how this works.

b --> c{ Choice: Go to shop }
c -- yes --> d1[ Hard edge: Eat hamburger ]
c -- no --> d2[ Stay hungry ]`;
let help = `a:
# Hi!

Welcome to this little tool to make flows!

Like you already now, a flow is a way to structurize steps to be taken to come to a certain solution for a stated problem.

What you see here is a very simplistic example, just to explain you how this works.

When you are ready you can *close this help* by clicking the button in the upper-right corner: 

![](https://imgur.com/8uza0v1.png)

And you can *edit* and *save* this flow or *open another*.

![](https://imgur.com/uIfLhzf.png)

When you click the *Edit* button you will see following 2 buttons and an edit field.

![](https://imgur.com/45boDAL.png)

## Definition
The definition defines the flow in a textual manner. This allows constructing flows fast.

This might look complicated. But it's actually fairly straightforward. Just hang in there.

---

%% Hi there! I am a comment. Below a flow crash course.

A node in flow is an **ID** + **label** encapsulated by (( )), ( ), [ ], { }.
Nodes can be strung together using e.g. -->.
For example:

\`a(( Problem: Out of hamburgers - CLICK ME! )) -- sigh --> b( Step: Get out of chair - CLICK ME TOO )\`

---

For all possibilities see <https://mermaidjs.github.io/flowchart.html>.

## Help
When you click *node a* you will see this linked help. The node label is the title of a help section, if there is no help linked.

Click **Close help**, **Edit** and the **Help** button next to **Definition** to edit the help.

*Notice that this help text starts with **a:**. There is a **b:** and a **d:** as well.* You can write your own **c:** if you like.

This example links help to a node with ID **a** and label *Problem: Out of hamburgers - CLICK ME!* encapsulated by *(( ))*, *( )*, *[ ]*, *{ }*.

Furthermore\\: *(1)*

*   Click the next node \`b( Step: Get out of chair - CLICK ME TOO )\` to see how you can make headings, add lists and do other various styling.
*   Be sure to checkout the other help for the last two nodes as well for node naming conventions.

*(1) Notice the \\\\ to escape the ':'. Otherwise the editor thinks that 'Furthermore' is a node ID.*

b:
# Help in style
Click **Close help**, **Edit** and the **Help** button next to **Definition** to edit the help.

Go ahead, play around with the editor! Be sure to check out **bold** and *italic* styling, or even [links](https://google.com). You can type the Markdown syntax, use the toolbar, or use shortcuts like \`cmd-b\` or \`ctrl-b\`.

For a full Markdown overview: <https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet>. Below a short overview.

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

c,d1,d2:
# Name-calling
**What?!** This help is the same for \`c{ Choice: Go to shop }\`, \`d1[ Hard edge: Eat hamburger ]\` and \`d2[ Stay hungry ]\`?

When there is **no** help available for specific elements in a layer (*d1(m)* and *d2(p)* in layer *d*), the **layer-wise help** is shown, if any.

To make naming nodes easy you can use the following manner:

![](https://imgur.com/JkATePW.png)

Furthermore, you can link help to multiple nodes. You can notate as a list, e.g.:

\`a,b,c1,d:\`

or as a range (only layers!), e.g.:

\`y..ac:\``;

let htmlHelp = {};
//#endregion

//#region help
const getNodeHelp = (nodeId) => {
    nodeId = nodeId.toLowerCase();
    let nodeHelp = htmlHelp[nodeId];
    let nodeLayer = '';
    if (!nodeHelp) {
        nodeLayer = findNodeLayer(nodeId);
        let keys = Object.keys(htmlHelp);
        // List and range
        for (let i = 0; i != keys.length; i++) {
            let key = keys[i];
            if (key.indexOf(',' + nodeId) > 0 || key.indexOf(nodeId + ',') > -1) {
                nodeHelp = htmlHelp[key];
                break;
            }
            else if (key.search(/[a-z]+\.\.+[a-z]/) === 0) {
                if (nodeLayerInRange(nodeLayer, key)) {
                    nodeHelp = htmlHelp[key];
                    break;
                }
            }
        }
    }
    if (!nodeHelp) {
        nodeHelp = htmlHelp[nodeLayer];
    }

    return nodeHelp;
};
// Lowercased only and following a, b, ..., z, aa, ab, ...
const nodeLayerInRange = (layer, range) => {
    let rangeSplit = range.split('..');
    let startLayer = findNodeLayer(rangeSplit[0]);
    let inclusiveEndLayer = findNodeLayer(rangeSplit[1]);

    // Switch values if a > b.
    let swtch = false;
    if (startLayer.length > inclusiveEndLayer.length) {
        swtch = true;
    }
    else if (startLayer.length === inclusiveEndLayer.length) {
        for (let i = 0; i != startLayer.length; i++) {
            let a = startLayer.charCodeAt(i);
            let b = inclusiveEndLayer.charCodeAt(i);
            if (a > b) {
                swtch = true;
                break;
            }
        }
    }

    if (swtch) {
        let x = startLayer;
        startLayer = inclusiveEndLayer;
        inclusiveEndLayer = x;
    }

    // Find layer in the range
    let prefix = '';
    let start = 'a'.charCodeAt(0);
    for (let i = 0; i != inclusiveEndLayer.length; i++) {
        let a = start;
        if (i < startLayer.length) {
            a = startLayer.charCodeAt(i);
        }
        let b = inclusiveEndLayer.charCodeAt(i);

        for (let j = a; j <= b; j++) {
            let candidate = prefix + String.fromCharCode(j);
            if (layer === candidate) {
                return true;
            }
        }

        prefix += 'a';
    }

    return false;
};
const findNodeLayer = (nodeId) => {
    let layerIdLength = nodeId.length;
    for (let i = nodeId.length - 1; i != -1; i--) {
        if (isNaN(nodeId[i])) {
            break;
        }
        layerIdLength--;
    }
    return nodeId.substring(0, layerIdLength);
};
//#endregion

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

    if (!s) {
        s = `graph TD
a((Nothing to see))`;
    }

    if (!s.startsWith('graph ')) {
        s = 'graph TD\n' + s;
    }

    return s;
};
// Post process.
const fixGraphDivAndEditorDimensions = () => {
    let graph = $('#graph-div')[0];
    let svg = graph.children[0];
    originalSvgWidth = svg.clientWidth;
    let widthPercent = 100 * originalSvgWidth / graph.getBoundingClientRect().width;

    if (widthPercent > maxPercentSvgWidth) {
        $(svg).attr('style', `max-width: ${maxPercentSvgWidth}%;`);
    }
    $(svg).removeAttr('height');

    if (!(simplemde.isSideBySideActive() || simplemde.isFullscreenActive())) {
        $("#graph-txt-wrapper .CodeMirror").height($(svg).height() - 100);
    }
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
        let objectSignatureIndex = kvpCandidate.search(/[a-zA-Z0-9_.,-]+\:/);
        if (objectSignatureIndex === 0) {
            let indexOfSplitter = kvpCandidate.indexOf(':');

            let key = kvpCandidate.substring(0, indexOfSplitter).trim();
            let value = kvpCandidate.substring(key.length + 1).trim();
            if (!value) {
                value = '\n\n';
            }

            if (htmlHelp[key.toLowerCase()]) {
                value = htmlHelp[key] + key + ':' + value;
            }

            htmlHelp[key.toLowerCase()] = value;
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
        $('#help-pane').hide();

        windowScrollY = window.pageYOffset;

        let nodeId = $(this).attr('id');
        let nodeHelp = getNodeHelp(nodeId);

        if (nodeHelp === undefined) {
            nodeHelp = '<h1>' + $(this)[0].textContent + '</h1>';
        }
        else {
            nodeHelp = marked(nodeHelp);
        }

        //To make selecting easier
        nodeHelp = '<div id=\'node-help-div\'>' + nodeHelp + '</div>';

        if (currentSelectedNode) {
            currentSelectedNode.removeClass('nodeSelected');
        }
        currentSelectedNode = $($(this)[0].children[0]);
        currentSelectedNode.addClass('nodeSelected');
        // behavior: smooth is not used because it results in a wrong offset of #nodeHelp.
        // There is no clean way to check when scrolling is finished.
        currentSelectedNode[0].scrollIntoView({ block: 'center' });

        $('#help-pane').html(nodeHelp);

        graphDivColumnClass = columnClasses.veryNarrow;
        $('#graph-div')[0].className = graphDivColumnClass;

        $('#save-btn').hide();
        $('#open-file-lbl').hide();
        $('#edit-btn').hide();
        $('#edit-pane').hide();
        $('#help-pane').fadeIn();
        $('#close-help-btn').show();

        $('#node-help-div').offset({ top: window.pageYOffset + $('#help-pane').offset().top, left: $('#node-help-div').offset().left })

        //$('#node-help-div::before').height($('#node-help-div').offset().top);
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
            if (graphDefinition) {
                mermaidAPI.render('graph-diagram', graphDefinition, function (svgCode) {
                    let graph = document.createElement('div');
                    graph.className = graphDivColumnClass;
                    graph.setAttribute('id', 'graph-div');
                    $('#container').children()[0].prepend(graph);

                    graph.innerHTML = svgCode;

                    fixGraphDivAndEditorDimensions();
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
    }
    simplemde.codemirror.refresh(); // Force refresh.
    $('#graph-div')[0].className = graphDivColumnClass;
    fixGraphDivAndEditorDimensions();
};
const openFileChange = (e) => {
    let f = e.target.files[0];
    if (f) {
        $('#open-file-lbl').text('Opening...');
        $('#controls').prop('disabled', true);
        $('.other-controls').hide();
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

            $('#open-file-lbl').text('Open');
            $('#controls').prop('disabled', false);
            $('.other-controls').fadeIn();
        }
        r.readAsArrayBuffer(f);
    }
};
const saveBtnClick = () => {
    if (errorText.length != 0 && !confirm('Are you sure that you want to save a flow containing errors?')) {
        return;
    }

    $('#save-btn').text('Saving...');
    $('#controls').prop('disabled', true);
    let db = new SQL.Database();
    db.run('CREATE TABLE flow (definition, help);');
    db.run('INSERT INTO flow VALUES (?,?)', [definition, help]);
    let blob = new Blob([db.export()], { type: 'application/octet-stream' });
    saveAs(blob, 'flow.sqlite3');
    $('#save-btn').text('Save');
    $('#controls').prop('disabled', false);
};
const closeHelpBtnClick = () => {
    $('#close-help-btn').hide();
    $('#edit-btn').show();
    $('#save-btn').show();
    $('#open-file-lbl').show();
    $('#help-pane').hide();

    if (isEditPaneVisible) {
        $('#edit-pane').show();
        graphDivColumnClass = columnClasses.narrow;
    }
    else {
        graphDivColumnClass = columnClasses.wide;
    }
    if (currentSelectedNode) {
        currentSelectedNode.removeClass('nodeSelected');
    }
    $('#graph-div')[0].className = graphDivColumnClass;

    window.scrollBy(0, windowScrollY);
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