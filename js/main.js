'use strict';
//#region fields
const alphabeth = 'abcdefghijklmnopqrstuvwxyz';
const columnClasses = { full: 'col-12', narrow: 'col-8', veryNarrow: 'col-4', half: 'col-6' };
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

let converter = new showdown.Converter({
    'tables': true,
    'strikethrough': true,
    'simpleLineBreaks': true,
    'requireSpaceBeforeHeadingText': true
});

let delayRenderingTimeout;
let wasEditPaneFirstTimeVisible = false;
let graphDivColumnClass = columnClasses.full;
let graphDivColumnClassSized = columnClasses.half;
let otherColumnClassSized = columnClasses.half;
let originalSvgWidth;
let editState = editStates.graph;
let errorText = '';
let isEditPaneVisible = false;
let windowScrollY = 0;
let currentSelectedNode;
let currentSelectedNodeId;

let definition = `%% Hi there! I am a comment. Below a flow crash course.

%% A node in flow is an **ID** + **label** encapsulated by (( )), ( ), [ ], { }.
%% Nodes can be strung together using e.g. -->.
%% For example:

a(( Problem: Out of hamburgers - CLICK ME! )) -- sigh --> b( Step: Get out of chair - CLICK ME TOO ) 

%% When you click "node a" you will see the linked help. Click the **Help** button next to **Definition** to see how this works.

b --> c{ Choice: Go to shop }
c -- yes --> d1[ Hard edge: Eat hamburger ]
c -- no --> d2[ Stay hungry ]

%% Notice that the node naming follows a certain pattern. Click one of the last 3 nodes in this example for a visual explanation.
%% If there are small inconsistencies in your flow, you can fix these by clicking 'fix node ids' right above this text editor. (e.g.  a --> e becomes a --> b)
%% Please note that this is an EXPERIMENTAL feature. Ranges and lists in help cannot be 'fixed'.`;
let help = `a:
# Hi!

Welcome to this little tool to make flows!

Like you already now, a flow is a way to structurize steps to be taken to come to a certain solution for a stated problem.

What you see here is a very simplistic example, just to explain you how this works.

When you are ready you can *close this help* by clicking the button in the upper-right corner: 

![](https://i.imgur.com/8uza0v1.png)

And you can *edit* and *save* this flow or *open another*.

![](https://i.imgur.com/uIfLhzf.png)

When you click the *Edit* button you will see following 2 buttons and an edit field.

![](https://i.imgur.com/45boDAL.png)

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

*Notice that this help text starts with **a:**. There is **b:** and **c,d1,d2:** as well.*

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

c, d:
# Name-calling
**What?!** This help is the same for \`c{ Choice: Go to shop }\`, \`d1[ Hard edge: Eat hamburger ]\` and \`d2[ Stay hungry ]\`?

When there is **no** help available for specific elements in a layer (*d1(m)* and *d2(p)* in layer *d*), the **layer-wise help** is shown, if any.

To make naming nodes easy you can use the following manner:

![](https://i.imgur.com/JkATePW.png)

Furthermore, you can link help to multiple nodes. You can notate as a list, e.g.:

\`a,b,c1,d:\`

or as a range (only layers!), e.g.:

\`y..ac:\``;

let htmlHelpSelectors = {};
let htmlHelpContent = [];

// A hack for the svg to base64 to work. Inline styling is available in mermaid 8.
// But it's release candidate does not work as well as mermaid 7. 
const svgInlineStyle = '#graph-diagram .label { font-family: "trebuchet ms", verdana, arial; color: #333; }#graph-diagram .node rect,#graph-diagram .node circle,#graph-diagram .node ellipse,#graph-diagram .node polygon { fill: #ECECFF; stroke: #9370DB; stroke-width: 1px; }#graph-diagram .node.clickable { cursor: pointer; }#graph-diagram .arrowheadPath { fill: #333333; }#graph-diagram .edgePath .path { stroke: #333333; stroke-width: 1.5px; }#graph-diagram .edgeLabel { background-color: #e8e8e8; }#graph-diagram .cluster rect { fill: #ffffde !important; stroke: #aaaa33 !important; stroke-width: 1px !important; }#graph-diagram .cluster text { fill: #333; }#graph-diagram div.mermaidTooltip { position: absolute; text-align: center; max-width: 200px; padding: 2px; font-family: "trebuchet ms", verdana, arial; font-size: 12px; background: #ffffde; border: 1px solid #aaaa33; border-radius: 2px; pointer-events: none; z-index: 100; }#graph-diagram .actor { stroke: #CCCCFF; fill: #ECECFF; }#graph-diagram text.actor { fill: black; stroke: none; }#graph-diagram .actor-line { stroke: grey; }#graph-diagram .messageLine0 { stroke-width: 1.5; stroke-dasharray: "2 2"; stroke: #333; }#graph-diagram .messageLine1 { stroke-width: 1.5; stroke-dasharray: "2 2"; stroke: #333; }#graph-diagram #arrowhead { fill: #333; }#graph-diagram #crosshead path { fill: #333 !important; stroke: #333 !important; }#graph-diagram .messageText { fill: #333; stroke: none; }#graph-diagram .labelBox { stroke: #CCCCFF; fill: #ECECFF; }#graph-diagram .labelText { fill: black; stroke: none; }#graph-diagram .loopText { fill: black; stroke: none; }#graph-diagram .loopLine { stroke-width: 2; stroke-dasharray: "2 2"; stroke: #CCCCFF; }#graph-diagram .note { stroke: #aaaa33; fill: #fff5ad; }#graph-diagram .noteText { fill: black; stroke: none; font-family: "trebuchet ms", verdana, arial; font-size: 14px; }#graph-diagram .activation0 { fill: #f4f4f4; stroke: #666; }#graph-diagram .activation1 { fill: #f4f4f4; stroke: #666; }#graph-diagram .activation2 { fill: #f4f4f4; stroke: #666; }#graph-diagram .section { stroke: none; opacity: 0.2; }#graph-diagram .section0 { fill: rgba(102, 102, 255, 0.49); }#graph-diagram .section2 { fill: #fff400; }#graph-diagram .section1,#graph-diagram .section3 { fill: white; opacity: 0.2; }#graph-diagram .sectionTitle0 { fill: #333; }#graph-diagram .sectionTitle1 { fill: #333; }#graph-diagram .sectionTitle2 { fill: #333; }#graph-diagram .sectionTitle3 { fill: #333; }#graph-diagram .sectionTitle { text-anchor: start; font-size: 11px; text-height: 14px; }#graph-diagram .grid .tick { stroke: lightgrey; opacity: 0.3; shape-rendering: crispEdges; }#graph-diagram .grid path { stroke-width: 0; }#graph-diagram .today { fill: none; stroke: red; stroke-width: 2px; }#graph-diagram .task { stroke-width: 2; }#graph-diagram .taskText { text-anchor: middle; font-size: 11px; }#graph-diagram .taskTextOutsideRight { fill: black; text-anchor: start; font-size: 11px; }#graph-diagram .taskTextOutsideLeft { fill: black; text-anchor: end; font-size: 11px; }#graph-diagram .taskText0,#graph-diagram .taskText1,#graph-diagram .taskText2,#graph-diagram .taskText3 { fill: white; }#graph-diagram .task0,#graph-diagram .task1,#graph-diagram .task2,#graph-diagram .task3 { fill: #8a90dd; stroke: #534fbc; }#graph-diagram .taskTextOutside0,#graph-diagram .taskTextOutside2 { fill: black; }#graph-diagram .taskTextOutside1,#graph-diagram .taskTextOutside3 { fill: black; }#graph-diagram .active0,#graph-diagram .active1,#graph-diagram .active2,#graph-diagram .active3 { fill: #bfc7ff; stroke: #534fbc; }#graph-diagram .activeText0,#graph-diagram .activeText1,#graph-diagram .activeText2,#graph-diagram .activeText3 { fill: black !important; }#graph-diagram .done0,#graph-diagram .done1,#graph-diagram .done2,#graph-diagram .done3 { stroke: grey; fill: lightgrey; stroke-width: 2; }#graph-diagram .doneText0,#graph-diagram .doneText1,#graph-diagram .doneText2,#graph-diagram .doneText3 { fill: black !important; }#graph-diagram .crit0,#graph-diagram .crit1,#graph-diagram .crit2,#graph-diagram .crit3 { stroke: #ff8888; fill: red; stroke-width: 2; }#graph-diagram .activeCrit0,#graph-diagram .activeCrit1,#graph-diagram .activeCrit2,#graph-diagram .activeCrit3 { stroke: #ff8888; fill: #bfc7ff; stroke-width: 2; }#graph-diagram .doneCrit0,#graph-diagram .doneCrit1,#graph-diagram .doneCrit2,#graph-diagram .doneCrit3 { stroke: #ff8888; fill: lightgrey; stroke-width: 2; cursor: pointer; shape-rendering: crispEdges; }#graph-diagram .doneCritText0,#graph-diagram .doneCritText1,#graph-diagram .doneCritText2,#graph-diagram .doneCritText3 { fill: black !important; }#graph-diagram .activeCritText0,#graph-diagram .activeCritText1,#graph-diagram .activeCritText2,#graph-diagram .activeCritText3 { fill: black !important; }#graph-diagram .titleText { text-anchor: middle; font-size: 18px; fill: black; }#graph-diagram g.classGroup text { fill: #9370DB; stroke: none; font-family: "trebuchet ms", verdana, arial; font-size: 10px; }#graph-diagram g.classGroup rect { fill: #ECECFF; stroke: #9370DB; }#graph-diagram g.classGroup line { stroke: #9370DB; stroke-width: 1; }#graph-diagram .classLabel .box { stroke: none; stroke-width: 0; fill: #ECECFF; opacity: 0.5; }#graph-diagram .classLabel .label { fill: #9370DB; font-size: 10px; }#graph-diagram .relation { stroke: #9370DB; stroke-width: 1; fill: none; }#graph-diagram #compositionStart { fill: #9370DB; stroke: #9370DB; stroke-width: 1; }#graph-diagram #compositionEnd { fill: #9370DB; stroke: #9370DB; stroke-width: 1; }#graph-diagram #aggregationStart { fill: #ECECFF; stroke: #9370DB; stroke-width: 1; }#graph-diagram #aggregationEnd { fill: #ECECFF; stroke: #9370DB; stroke-width: 1; }#graph-diagram #dependencyStart { fill: #9370DB; stroke: #9370DB; stroke-width: 1; }#graph-diagram #dependencyEnd { fill: #9370DB; stroke: #9370DB; stroke-width: 1; }#graph-diagram #extensionStart { fill: #9370DB; stroke: #9370DB; stroke-width: 1; }#graph-diagram #extensionEnd { fill: #9370DB; stroke: #9370DB; stroke-width: 1; }#graph-diagram .commit-id,#graph-diagram .commit-msg,#graph-diagram .branch-label { fill: lightgrey; color: lightgrey; } #graph-diagram { color: rgba(0, 0, 0, 0.65); font: ; }';

// Very messy, but necessary for the docx export.
const mainInlineStyle = '#graph-div {text-align: center;}.node-help-head { font-weight: bold; color: #9370DB; }.nodes .node {color: black;}.edgeLabel {color: black;}';
const tableInlineStyle = 'table { border-collapse: collapse; border-spacing: 0; empty-cells: show; border: 1px solid #cbcbcb; margin: 1rem 0; } table caption { color: #000; font: italic 85%/1 arial, sans-serif; padding: 1em 0; text-align: center; } table td, table th { border-left: 1px solid #cbcbcb; border-width: 0 0 0 1px; font-size: inherit; margin: 0; overflow: visible; padding: 0.5em 1em; } table td:first-child, table th:first-child { border-left-width: 0; } table thead { background-color: #e0e0e0; color: #000; text-align: left; vertical-align: bottom; } table tr:nth-child(2n-1) td { background-color: #f2f2f2; }';
//#endregion

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
            $('#export-btn').prop('disabled', false);
            $('#fixNodeIds-btn').prop('disabled', false);

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
                    bindNodeHover();

                    //inline css
                    graph.children[0].children[0].innerHTML = svgInlineStyle;
                });
            }
        }
        else {
            $('#export-btn').prop('disabled', true);
            $('#fixNodeIds-btn').prop('disabled', true);

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
const fillHtmlHelp = () => {
    htmlHelpSelectors = {};
    htmlHelpContent = [];
    let split = help.split(/[\n\r]/g);
    let lastNodeIds = [];
    for (let i = 0; i != split.length; i++) {
        let kvpCandidate = split[i];
        if (kvpCandidate) {
            kvpCandidate = kvpCandidate.trim();
        }

        //Search first index of one or more numbers or letters followed by a :.
        let objectSignatureIndex = kvpCandidate.search(/[ \ta-zA-Z0-9_.,-]+\:/);
        if (objectSignatureIndex === 0) {
            let indexOfSplitter = kvpCandidate.indexOf(':');

            let key = kvpCandidate.substring(0, indexOfSplitter).trim();

            let nodeIds = findNodeIdsForHelp(key);
            if (nodeIds.length) {
                lastNodeIds = nodeIds;
            }
            if (lastNodeIds) {
                let value = kvpCandidate.substring(key.length + 1).trim();
                if (!value) {
                    value = '\n';
                }

                let nodeId = lastNodeIds[0];
                let keys = Object.keys(htmlHelpSelectors);
                let nodeIdIndex = keys.indexOf(nodeId);
                if (nodeIdIndex === -1) {
                    htmlHelpContent.push(value);
                    nodeIdIndex = htmlHelpContent.length - 1;
                }
                else { // Add as text to existing
                    htmlHelpContent[nodeIdIndex] += key + ':' + value;
                }

                for (let i = 0; i != lastNodeIds.length; i++) {
                    htmlHelpSelectors[lastNodeIds[i]] = nodeIdIndex;
                }
            }
        }
        else {
            if (lastNodeIds) {
                let nodeId = lastNodeIds[0];
                let keys = Object.keys(htmlHelpSelectors);
                let nodeIdIndex = keys.indexOf(nodeId);
                if (!kvpCandidate) {
                    kvpCandidate = '\n';
                }

                if (nodeIdIndex === -1) {
                    htmlHelpContent.push(kvpCandidate);
                    nodeIdIndex = htmlHelpContent.length - 1;
                }
                else { // Add as text to existing
                    htmlHelpContent[nodeIdIndex] += '\n' + kvpCandidate;
                }

                for (let i = 0; i != lastNodeIds.length; i++) {
                    htmlHelpSelectors[lastNodeIds[i]] = nodeIdIndex;
                }
            }
        }
    }
};
// Returns lower cased node ids when found. Works for layers and ranges.
const findNodeIdsForHelp = (helpKey) => {
    let nodeIds = [];
    helpKey = helpKey.replace(/ |\t/g, '').toLowerCase();
    $.each($('#graph-diagram .nodes .node'), (index, value) => {
        let nodeId = $(value).attr('id').toLowerCase();
        if (nodeIds.indexOf(nodeId) > -1) {
            return;
        }

        if (nodeId == helpKey) {
            nodeIds.push(nodeId);
            return;
        }

        if (helpKey.indexOf(',' + nodeId) > 0 || helpKey.indexOf(nodeId + ',') > -1) {
            nodeIds.push(nodeId);
            return;
        }

        let nodeLayer = findNodeLayer(nodeId);
        if (helpKey.indexOf(',' + nodeLayer) > 0 || helpKey.indexOf(nodeLayer + ',') > -1) {
            nodeIds.push(nodeId);
            return;
        }

        if (helpKey.search(/[a-z]+\.\.+[a-z]/) === 0) {
            if (nodeLayerInRange(nodeLayer, helpKey)) {
                nodeIds.push(nodeId);
            }
            return;
        }

    });
    return nodeIds;
}
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
const bindNodeClick = () => {
    $('#graph-diagram .nodes .node').click(function () {
        $('#help-pane').hide();
        $('[data-toggle="tooltip"]').tooltip('dispose');

        windowScrollY = window.pageYOffset;

        let nodeId = $(this).attr('id');
        let nodeHelp = htmlHelpContent[htmlHelpSelectors[nodeId.toLowerCase()]];

        //To make selecting easier
        nodeHelp = '<div id=\'node-help-div\'><label class=\'node-help-head\'>' + $(this).text() + '</label>' +
            (nodeHelp === undefined ? '' : converter.makeHtml(nodeHelp)) +
            '</div>';

        if (currentSelectedNode) {
            currentSelectedNode.removeClass('nodeSelected');
        }
        currentSelectedNodeId = $(this)[0].id;
        currentSelectedNode = $($(this)[0].children[0]);
        currentSelectedNode.addClass('nodeSelected');
        // behavior: smooth is not used because it results in a wrong offset of #nodeHelp.
        // There is no clean way to check when scrolling is finished.
        currentSelectedNode[0].scrollIntoView({ block: 'center' });

        $('#help-pane').html(nodeHelp);

        graphDivColumnClass = graphDivColumnClassSized;
        $('#graph-div')[0].className = graphDivColumnClass;
        $('#edit-pane')[0].className = otherColumnClassSized;
        $('#help-pane')[0].className = otherColumnClassSized;

        $('#save-btn').hide();
        $('#export-btn').hide();
        $('#open-file-lbl').hide();
        $('#edit-btn').hide();
        $('#edit-pane').hide();
        $('#help-pane').fadeIn();
        $('#close-help-btn').show();
        $('#size-controls').show();

        $('#node-help-div').offset({ top: window.pageYOffset + $('#help-pane').offset().top, left: $('#node-help-div').offset().left });
    });
};
// Only when editting
const bindNodeHover = () => {
    if (isEditPaneVisible) {
        $.each($('#graph-diagram .nodes .node'), (index, value) => {
            let node = $(value);

            node.attr('href', '#');
            node.attr('data-toggle', 'tooltip');
            node.attr('data-placement', 'left');
            node.attr('data-delay', '{"show":"900", "hide":"300"}');
            node.attr('title', node.attr('id'));
        });
        $('[data-toggle="tooltip"]').tooltip();
    }
};
//#endregion

//#region fix node ids
const fixNodeIds = () => {
    if (errorText.length != 0) {
        return;
    }
    let newDefinition = '';
    let newHelp = '';
    let oldToNewNodeIdMap = sortOldToNewNodeIdMap(getOldToNewNodeIdMap());

    let sortedMapKeys = Object.keys(oldToNewNodeIdMap);
    if (sortedMapKeys.length === 0) {
        return;
    }

    if (confirm('Inconsistent node ids found. Are you sure you want to fix this? [Experimental]')) {
        let split = definition.split(/[\n\r]/g);
        for (let i = 0; i != split.length; i++) {
            let trimmedLine = split[i].trim();
            if (!trimmedLine.startsWith('%%')) {
                for (let j = 0; j != sortedMapKeys.length; j++) {
                    let oldNodeId = sortedMapKeys[j];
                    if (trimmedLine.indexOf(oldNodeId) != -1) {
                        trimmedLine = fixNodeIdsInDefinition(trimmedLine, oldNodeId, oldToNewNodeIdMap[oldNodeId]);
                    }
                }
            }
            newDefinition += trimmedLine + '\n';
        }
        definition = newDefinition.trim();

        split = help.split(/[\n\r]/g);
        for (let i = 0; i != split.length; i++) {
            let trimmedLine = split[i].trim();
            for (let j = 0; j != sortedMapKeys.length; j++) {
                let oldNodeId = sortedMapKeys[j];
                if (trimmedLine.startsWith(oldNodeId + ':')) {
                    trimmedLine = oldToNewNodeIdMap[oldNodeId] + ': ' + trimmedLine.substring(oldNodeId.length + 1);

                    if (trimmedLine.length === (oldToNewNodeIdMap[oldNodeId] + ': ').length) {
                        trimmedLine = trimmedLine.trim();
                    }
                }
            }
            newHelp += trimmedLine + '\n';
        }
        help = newHelp.trim();

        simplemde.value(editState === editStates.graph ? definition : help);
        simplemde.codemirror.refresh(); // Force refresh.

        simplemde.codemirror.on("changes", delayRenderGraph);

        renderGraph();

        simplemde.codemirror.refresh(); // Force refresh.
    }
};
const fixNodeIdsInDefinition = (line, oldNodeId, newId) => {
    let newLine = '';

    let splitLine = [];
    // Split the path, if any, ignoring all paths and path labels.
    let regex = /(((===|---|-\.--|==>|-->|-\.->)\|(.*?)+\|)|==(.*?)>|--(.*?)>|-\.(.*?)>|==(.*?)=|--(.*?)-|-\.(.*?)--)/g;
    let found = regex.exec(line);

    if (found) {
        splitLine.push(found.index === -1 ?
            line : line.substring(0, found.index), found[0], line.substring(found.index + found[0].length));
    }
    else {
        splitLine.push(line);
    }

    for (let i = 0; i != splitLine.length; i++) {
        let part = splitLine[i];
        if (i === 1) {
            newLine += part;
        }
        else {
            let oldNodeIdIndex = part.indexOf(oldNodeId);
            if (oldNodeIdIndex === -1) {
                newLine += part;
            }
            else {
                regex = /[\({\[]/g; // If the old node id is ecapsulated --> do not replace
                found = regex.exec(part);
                if (found) {
                    newLine += found.index > oldNodeIdIndex ?
                        part.substring(0, oldNodeIdIndex) + newId + part.substring(oldNodeIdIndex + oldNodeId.length) :
                        part;
                }
                else {
                    newLine += newId; //part === oldNodeId
                }
            }
        }
    }

    return newLine;
};
// To make sure node Ids follow correct naming conventions. Only for graph TD
const getOldToNewNodeIdMap = () => {
    let layerIndex = 0;
    let nodeIndexInLayer = 1;
    let prevLayerY = 0;
    let oldToNewNodeIdMap = {};
    let newLayersAndOldIds = {}; //For omitting node indexes in layer if only one node in a layer.
    $('#graph-diagram .nodes .node').each(function (index) {
        let nodeId = $(this)[0].id;
        let layerY = $(this).attr('transform').split(",")[1];
        layerY = layerY.substring(0, layerY.length - 1);

        if (layerY === prevLayerY) {
            ++nodeIndexInLayer;
        }
        else {
            nodeIndexInLayer = 1;
            ++layerIndex;
        }

        let newLayer = layerIndexToLayer(layerIndex);
        let newId = newLayer + nodeIndexInLayer;

        if (nodeId != newId) {
            oldToNewNodeIdMap[nodeId] = newId;
            if (newLayersAndOldIds[newLayer] === undefined) {
                newLayersAndOldIds[newLayer] = [];
            }
            newLayersAndOldIds[newLayer].push(nodeId);
        }

        prevLayerY = layerY;
    });

    //Omit node indexes in layer if only one node in a layer.
    let keys = Object.keys(newLayersAndOldIds);
    for (let i = 0; i != keys.length; i++) {
        let layer = keys[i];
        let oldIds = newLayersAndOldIds[layer];
        if (oldIds.length === 1) {
            let oldId = oldIds[0];
            if (oldId === layer) {
                delete oldToNewNodeIdMap[oldId];
            }
            else if(oldToNewNodeIdMap[oldId] === layer + '1') {
                oldToNewNodeIdMap[oldId] = layer;
            }
        }
    }

    return oldToNewNodeIdMap;
};
// Max zz (26*26 layers), layerIndex --> 1 based
const layerIndexToLayer = (layerIndex) => {
    let layer = '';
    let l1Index = Math.floor(layerIndex / 26);
    let l2Index = (layerIndex % 26);

    if (l1Index != 0) {
        layer = alphabeth[l1Index - 1];
    }

    layer += alphabeth[l2Index - 1];

    return layer;
};
const sortOldToNewNodeIdMap = (oldToNewNodeIdMap) => {
    let map = {};
    let layers = [];
    let layersAndNodes = {};
    let keys = Object.keys(oldToNewNodeIdMap);
    for (let i = 0; i != keys.length; i++) {
        let nodeId = keys[i];
        let layer = findNodeLayer(nodeId);
        if (layers.indexOf(layer === -1)) {
            layers.push(layer);
        }
        if (layersAndNodes[layer] === undefined) {
            layersAndNodes[layer] = [];
        }
        layersAndNodes[layer].push(nodeId)
    }
    layers.sort((a, b) => b.length - a.length); //Sort longes to shortest.

    for (let i = 0; i != layers.length; i++) {
        let layer = layers[i];
        let nodes = layersAndNodes[layer];
        nodes.sort((a, b) => b.length - a.length);

        for (let j = 0; j != nodes.length; j++) {
            let node = nodes[j];
            map[node] = oldToNewNodeIdMap[node];
        }
    }

    return map;
}
//#endregion

//#region menu
const editBtnClick = () => {
    let prevGraphDivColumnClass = graphDivColumnClass;

    if ($('#edit-pane').attr('style').indexOf('display: none') === -1) {
        graphDivColumnClass = columnClasses.full;

        $('[data-toggle="tooltip"]').tooltip('dispose');
        $('#size-controls').hide();

        isEditPaneVisible = false;
    }
    else {
        graphDivColumnClass = graphDivColumnClassSized;
        $('#edit-pane')[0].className = otherColumnClassSized;
        $('#help-pane')[0].className = otherColumnClassSized;

        $('#size-controls').show();

        isEditPaneVisible = true;
    }
    $('#edit-pane').toggle();

    if (!wasEditPaneFirstTimeVisible) {
        wasEditPaneFirstTimeVisible = true;
        simplemde.value(definition);
    }
    simplemde.codemirror.refresh(); // Force refresh.

    if (wasEditPaneFirstTimeVisible && prevGraphDivColumnClass === columnClasses.veryNarrow) {
        renderGraph();
    }

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
const exportBtnClick = () => {
    if (errorText.length != 0) {
        return;
    }

    $('#export-btn').text('Exporting...');
    $('#controls').prop('disabled', true);

    let divToExport = $('<div></div>');

    let canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");

    appendGraph(divToExport, canvas, context).then(
        div => {
            divToExport = div;
            divToExport.append('<br>');

            let prevNodeHelpIndex = -1;
            let nodeHelpLabels = [];
            let nodeHelp;
            let keys = Object.keys(htmlHelpSelectors);
            for (let i = 0; i != keys.length; i++) {
                let nodeId = keys[i];
                let nodeHelpIndex = htmlHelpSelectors[nodeId];

                if (prevNodeHelpIndex != nodeHelpIndex) {
                    if (prevNodeHelpIndex != -1) {
                        divToExport.append('<div class=\'node-help-head\'>' + nodeHelpLabels.join(' | ') + '</div>');
                        divToExport.append(nodeHelp);

                        nodeHelpLabels = null;
                        nodeHelp = null;
                    }

                    nodeHelpLabels = [];
                    nodeHelp = converter.makeHtml(htmlHelpContent[nodeHelpIndex]) + '<br>';

                    prevNodeHelpIndex = nodeHelpIndex;
                }

                nodeHelpLabels.push($('#' + nodeId).text());
            }

            if (nodeHelp) {
                divToExport.append('<div class=\'node-help-head\'>' + nodeHelpLabels.join(' | ') + '</div>');
                divToExport.append(nodeHelp);
            }

            let toExport = '<!DOCTYPE html><html><head><title>Flow</title><style>' +
                mainInlineStyle + ' ' + tableInlineStyle + '</style></head><body>' +
                divToExport[0].innerHTML + '</body></html>';

            let blob = htmlDocx.asBlob(toExport);
            saveAs(blob, 'flow.docx');

            exportFinished();
        },
        err => exportFinished(err)
    );
};
const exportFinished = (err) => {
    $('#export-btn').text('Export');
    $('#controls').prop('disabled', false);

    if (err) {
        console.error(err);
        alert('Export to docx failed.');
    }
}
const appendGraph = (div, canvas, context) => {
    return new Promise((resolve, reject) => {
        let imgStub = new Image;
        imgStub.crossOrigin = 'Anonymous';

        imgStub.addEventListener('load', () => {
            canvas.width = imgStub.width;
            canvas.height = imgStub.height;

            context.drawImage(imgStub, 0, 0);

            try {
                let img = new Image
                img.src = canvas.toDataURL("image/png");

                let graphDiv = $('<div id="graph-div"></div>')
                graphDiv.append(img);
                div.append(graphDiv);
                resolve(div);
            }
            catch (err) {
                reject(err);
            }
        });
        let svg = $('#graph-div')[0].children[0];
        imgStub.width = svg.clientWidth;
        imgStub.height = svg.clientHeight;
        imgStub.src = 'data:image/svg+xml;base64,' + btoa(new XMLSerializer().serializeToString(svg));
    });
};
const closeHelpBtnClick = () => {
    let prevGraphDivColumnClass = graphDivColumnClass;

    $('#close-help-btn').hide();
    $('#edit-btn').show();
    $('#save-btn').show();
    $('#export-btn').show();
    $('#open-file-lbl').show();
    $('#help-pane').hide();

    if (isEditPaneVisible) {
        graphDivColumnClass = graphDivColumnClassSized;
        $('#edit-pane')[0].className = otherColumnClassSized;
        $('#help-pane')[0].className = otherColumnClassSized;

        $('#edit-pane').show();
        $('#size-controls').show();
    }
    else {
        graphDivColumnClass = columnClasses.full;
        $('#size-controls').hide();
    }
    if (currentSelectedNode) {
        currentSelectedNode.removeClass('nodeSelected');
        currentSelectedNodeId = null;
    }

    if (prevGraphDivColumnClass === columnClasses.veryNarrow) {
        renderGraph();
    }

    $('#graph-div')[0].className = graphDivColumnClass;
    fixGraphDivAndEditorDimensions();

    window.scrollBy(0, windowScrollY);
};
const size = (leftColumnClass, rightColumnClass) => {
    graphDivColumnClassSized = leftColumnClass;
    otherColumnClassSized = rightColumnClass;
    graphDivColumnClass = graphDivColumnClassSized;

    renderGraph();

    if (currentSelectedNodeId) {
        currentSelectedNode = $($('#' + currentSelectedNodeId)[0].children[0]);
        currentSelectedNode.addClass('nodeSelected');

        currentSelectedNode[0].scrollIntoView({ block: 'center' });
    }

    $('#edit-pane')[0].className = otherColumnClassSized;
    $('#help-pane')[0].className = otherColumnClassSized;

    // Workaround for the toggle button active states to work as they should.
    setTimeout(() => {
        try {
            $('#node-help-div').offset({ top: window.pageYOffset + $('#help-pane').offset().top, left: $('#node-help-div').offset().left });
        }
        catch (e) {
            // Became null
        }
    }, 10);
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
    $('#edit-btn').click(editBtnClick);
    $('#open-file').change(openFileChange);
    $('#save-btn').click(saveBtnClick);
    $('#export-btn').click(exportBtnClick);

    $('#small-column-left').change(() => { size(columnClasses.veryNarrow, columnClasses.narrow) });
    $('#equal-sized-columns').change(() => { size(columnClasses.half, columnClasses.half) });
    $('#small-column-right').change(() => { size(columnClasses.narrow, columnClasses.veryNarrow) });

    $('#close-help-btn').click(closeHelpBtnClick);
    $('#definition-btn').change(definitionBtnChange);
    $('#help-btn').change(helpBtnChange);
    $('#fixNodeIds-btn').click(fixNodeIds);

    simplemde = new SimpleMDE({
        element: $("#graph-txt")[0],
        spellChecker: false,
        toolbar: ['bold', 'italic', 'heading', 'horizontal-rule', '|',
            'quote', 'unordered-list', 'ordered-list', 'table', '|',
            'link', 'image', '|',
            'side-by-side', 'fullscreen', '|',
            'guide'
        ]
    });
    //Following gives Uncaught TypeError.  https://github.com/sparksuite/simplemde-markdown-editor/issues #727 
    //simplemde.codemirror.options.lineNumbers = true;

    $("#graph-txt-wrapper .editor-toolbar").hide();
    simplemde.codemirror.on("changes", delayRenderGraph);

    //marked.setOptions({    });

    renderGraph();
}

$(document).ready(main);