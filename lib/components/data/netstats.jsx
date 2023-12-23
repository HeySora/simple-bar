import * as Uebersicht from "uebersicht";
import * as DataWidget from "./data-widget.jsx";
import * as DataWidgetLoader from "./data-widget-loader.jsx";
import Graph from "./graph.jsx";
import useWidgetRefresh from "../../hooks/use-widget-refresh.js";
import useServerSocket from "../../hooks/use-server-socket";
import { useSimpleBarContext } from "../context.jsx";
import * as Icons from "../icons.jsx";
import * as Utils from "../../utils.js";

export { netstatsStyles as styles } from "../../styles/components/data/netstats";

const DEFAULT_REFRESH_FREQUENCY = 2000;
const GRAPH_LENGTH = 30;

export const Widget = Uebersicht.React.memo(() => {
  const { display, settings } = useSimpleBarContext();
  const { widgets, netstatsWidgetOptions } = settings;
  const { netstatsWidget } = widgets;
  const { refreshFrequency, showOnDisplay, displayAsGraph } =
    netstatsWidgetOptions;

  const refresh = Uebersicht.React.useMemo(
    () =>
      Utils.getRefreshFrequency(refreshFrequency, DEFAULT_REFRESH_FREQUENCY),
    [refreshFrequency]
  );

  const visible =
    Utils.isVisibleOnDisplay(display, showOnDisplay) && netstatsWidget;

  const [graph, setGraph] = Uebersicht.React.useState([]);
  const [state, setState] = Uebersicht.React.useState();
  const [loading, setLoading] = Uebersicht.React.useState(visible);

  const resetWidget = () => {
    setState(undefined);
    setLoading(false);
  };

  const getNetstats = Uebersicht.React.useCallback(async () => {
    if (!visible) return;
    try {
      const output = await Uebersicht.run(
        `bash ./simple-bar/lib/scripts/netstats.sh 2>&1`
      );
      const data = Utils.cleanupOutput(output);
      const json = JSON.parse(data);
      setState(json);
      if (displayAsGraph) {
        Utils.addToGraphHistory(json, setGraph, GRAPH_LENGTH);
      }
      setLoading(false);
    } catch (e) {
      setTimeout(getNetstats, 1000);
    }
  }, [displayAsGraph, setGraph, visible]);

  useServerSocket("netstats", visible, getNetstats, resetWidget);
  useWidgetRefresh(visible, getNetstats, refresh);

  if (loading)
    return (
      <Uebersicht.React.Fragment>
        <DataWidgetLoader.Widget className="netstats" />
        {!displayAsGraph && <DataWidgetLoader.Widget className="netstats" />}
      </Uebersicht.React.Fragment>
    );

  if (!state) {
    return null;
  }

  const { download, upload } = state;

  if (download === undefined || upload === undefined) {
    return null;
  }

  const formatedDownload = formatBytes(download);
  const formatedUpload = formatBytes(upload);

  if (displayAsGraph) {
    return (
      <DataWidget.Widget classes="netstats netstats--graph" disableSlider>
        <Graph
          className="netstats__graph"
          caption={{
            download: {
              value: formatedDownload,
              icon: Icons.Download,
              color: "var(--magenta)",
            },
            upload: {
              value: formatedUpload,
              icon: Icons.Upload,
              color: "var(--blue)",
            },
          }}
          values={graph}
          maxLength={GRAPH_LENGTH}
        />
      </DataWidget.Widget>
    );
  }

  return (
    <Uebersicht.React.Fragment>
      <DataWidget.Widget classes="netstats" disableSlider>
        <div className="netstats__item">
          <Icons.Download className="netstats__icon netstats__icon--download" />
          <span
            className="netstats__value"
            dangerouslySetInnerHTML={{ __html: formatedDownload }}
          />
        </div>
      </DataWidget.Widget>
      <DataWidget.Widget classes="netstats" disableSlider>
        <div className="netstats__item">
          <Icons.Upload className="netstats__icon netstats__icon--upload" />
          <span
            className="netstats__value"
            dangerouslySetInnerHTML={{ __html: formatedUpload }}
          />
        </div>
      </DataWidget.Widget>
    </Uebersicht.React.Fragment>
  );
});

Widget.displayName = "Netstats";

function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return "0b";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["b", "kb", "mb", "gb", "tb", "pb", "eb", "zb", "yb"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}<em>${
    sizes[i]
  }</em>`;
}