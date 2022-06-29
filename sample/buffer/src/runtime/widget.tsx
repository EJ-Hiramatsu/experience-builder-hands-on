/** @jsx jsx */
import { React, AllWidgetProps, css, jsx } from "jimu-core";
import { JimuMapViewComponent, JimuMapView } from "jimu-arcgis";
import { Label, Select, Option, NumericInput, Checkbox, Table } from "jimu-ui";
import Point from "esri/geometry/Point";
import Polygon from "esri/geometry/Polygon";
import geometryEngine from "esri/geometry/geometryEngine";
import SimpleFillSymbol from "esri/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "esri/symbols/SimpleLineSymbol";
import SimpleMarkerSymbol from "esri/symbols/SimpleMarkerSymbol";
import Graphic from "esri/Graphic";
import Query from "esri/rest/support/Query";
import LayerView from "esri/views/layers/LayerView";
import Collection from "esri/core/Collection";
export default class Widget extends React.PureComponent<AllWidgetProps<any>, any> {


  // 処理内で利用する変数を定義
  state = {
    jimuMapView: null, /** 対象 Webマップ */
    webmapLayers: [], /** Web マップのレイヤー情報 */
    selectLayer: null, /** 選択したレイヤー情報 */
    distance: 0, /** バッファーの半径距離 */
    widgetEnable: false /** バッファー処理実行フラグ */
  };

  // マップ ウィジェットが変更されたときにマップ情報とクリックイベントの設定
  activeViewChangeHandler = (jmv: JimuMapView) => {
    if (jmv) {
      this.setState({
        jimuMapView: jmv,
        webmapLayers: this.setLayerList(jmv.view.layerViews)
      });
      // 対象のマップをクリック イベントを取得
      jmv.view.on("click", (evt) => {
        // バッファー処理はチェックがオンになっている時のみ実行
        if (this.state.widgetEnable) {
          // 必須項目入力チェック
          let msg = this.eventErrorCheck();
          if (msg.length != 0) {
            // 必須項目が入力されていない場合はエラー
            alert(msg);
            return;
          }
          // Web マップ クリック時イベントを実行
          this.doClickEvent(evt);
        }
      });
    }
  };

  // 必須項目入力チェック
  eventErrorCheck = () => {
    let requrirdMsg = ""; /** エラーメッセージ格納用 */

    // レイヤーが選択されていない場合はエラー
    if (this.state.selectLayer.length == 0) {
      requrirdMsg = "対象のレイヤーを選択してください。\n";
    }

    // バッファー距離半径が 0 以下の場合はエラー
    if (this.state.distance <= 0) {
      requrirdMsg = requrirdMsg + "バッファーの距離（半径）は 0 より大きい値を入力してください。";
    }

    return requrirdMsg;
  }

  // Web マップ クリック時イベント
  doClickEvent = (evt: Object) => {

    // 前回の実行結果があれば削除する。
    this.state.jimuMapView.view.graphics.removeAll();

    // マップをクリックした地点の位置情報を取得
    const point: Point = this.state.jimuMapView.view.toMap({
      x: evt.x,
      y: evt.y
    });

    // 指定した条件でバッファーを作成
    const buffer = geometryEngine.geodesicBuffer(point, this.state.distance, this.props.config.distanceUnit, false);

    // バッファーの作成が正常に終了した場合に描画処理を実行
    if (buffer) {
      // バッファーのグラフィックを定義
      let bufGraphic = new Graphic({
        geometry: buffer,
        symbol: this.setBufferSymbol();
      });
      // バッファーのグラフィックをマップに表示
      this.state.jimuMapView.view.graphics.add(bufGraphic);

      // バッファー内のレイヤー取得およびマーキング処理実行
      this.layerGetAndMarking(buffer);
    }
  }

  // バッファー内のレイヤー取得およびマーキング処理
  layerGetAndMarking = (buffer: Polygon) => {
    // プルダウンで選択したレイヤーをウェブマップから取得
    const targetLayer = this.state.jimuMapView.view.map.findLayerById(this.state.selectLayer);
    // 取得したレイヤータイプがフィーチャレイヤーの場合描画処理を実行
    if (targetLayer.type == "feature") {
      // バッファー内にある対象のレイヤーを取得
      const query = new Query({ returnGeometry: true });
      query.geometry = buffer;
      query.spatialRelationship = "contains";

      // バッファー内にあるオブジェクトを取得
      targetLayer.queryFeatures(query).then(results => {
        let highlightSymbol; /** シンボル設定用 */
        // バッファー内にあるオブジェクトの数だけ繰り返す
        for (let idx = 0; idx < results.features.length; idx++) {
          if (targetLayer.geometryType === 'point' || targetLayer.geometryType === 'multipoint') {
            // ポイントのマーキング シンボルを定義
            highlightSymbol = this.setPointMarking();
          } else if (targetLayer.geometryType === 'polyline') {
            // ラインのマーキング シンボルを定義
            highlightSymbol = this.setLineMarking();
          } else if (targetLayer.geometryType === 'polygon') {
            // ポリゴンのマーキング シンボルを定義
            highlightSymbol = this.setPolygonMarking();
          }
          // 取得されたレイヤーのグラフィックを定義し Web マップに追加
          var queryGraphics = new Graphic({
            geometry: results.features[idx].geometry,
            symbol: highlightSymbol
          });
          // 対象のシンボルにマーキング用グラフィックを重ねる
          this.state.jimuMapView.view.graphics.add(queryGraphics);
        }
      })
        .catch(error => {
          console.log("targetLayer.queryFeatures error:", error.messagae);
        });
    }
  }

  // バッファー用のシンボル（ポイント）を定義
  setBufferSymbol = () => {
    return new SimpleFillSymbol({
      color: [51, 51, 204, 0.2],
      style: "solid",
      outline: {
        color: "black",
        width: 1
      }
    });
  }

  // マーキング用のシンボル（ポイント）を定義
  setPointMarking = () => {
    return new SimpleMarkerSymbol({
      color: [255, 0, 0, 0.5],
      outline: {
        color: [0, 0, 0, 0.5],
        width: 1
      }
    });
  }

  // マーキング用のシンボル（ライン）を定義
  setLineMarking = () => {
    return new SimpleLineSymbol({
      style: "solid",
      color: [255, 0, 0, 0.5],
      width: 6
    });
  }

  // マーキング用のシンボル（ポリゴン）を定義
  setPolygonMarking = () => {
    return new SimpleFillSymbol({
      color: [255, 0, 0, 0.5],
      style: "solid",
      outline: {
        color: [0, 0, 0, 0.5],
        width: 1
      }
    });
  }

  // Web マップに設定されいてるレイヤー情報の取得
  setLayerList = (layers: Collection<LayerView>) => {
    const list = [];
    for (let idx = layers.length; 0 < idx; idx--) {
      const layer = layers.items[idx - 1];
      list[idx] = { id: layer.layer.id, name: layer.layer.title }
    }
    return list

  }

  // マーキング対象のレイヤーを設定
  selLayer = (selected: React.FormEvent<HTMLInputElement>) => {
    this.setState({
      selectLayer: selected.currentTarget.value
    });
  };

  // バッファーの半径を設定
  chgBufDst = (numVal: Number) => {
    this.setState({
      distance: numVal
    });
  };

  // 処理実行可否の設定
  chgWdgEbl = () => {
    const ebl = this.state.widgetEnable;
    if (ebl) {
      this.setState({ widgetEnable: false });
    } else {
      this.setState({ widgetEnable: true });
    }
  };

  // UI 情報レンダリング
  render() {
    // UI のデザインを設定
    const widgetStyle = css`
    background-color: var(--white);
    padding: 10px;
    height: 200px;
    `
    const tableStyle = css`
    background-color: var(--white);
    `

    // レイヤーリストをプルダウンに設定
    const { webmapLayers } = this.state;
    let layerList = webmapLayers.length > 0
      && webmapLayers.map((item, idx) => {
        return (
          <Option key={idx} value={String(item.id)}>{item.name}</Option>
        )
      }, this);

    return (
      <div className="widget-starter jimu-widget" css={widgetStyle}>
        {this.props.hasOwnProperty("useMapWidgetIds") &&
          this.props.useMapWidgetIds &&
          this.props.useMapWidgetIds[0] && (
            <JimuMapViewComponent
              useMapWidgetId={this.props.useMapWidgetIds?.[0]}
              onActiveViewChange={this.activeViewChangeHandler}
            />
          )
        }
        <h3>バッファー検索</h3>
        <Table css={tableStyle}>
          <tr>
            <Label>
              レイヤー：
              <Select
                onChange={this.selLayer}
                autoWidth={true}
                placeholder="対象とするレイヤーを選択してください。">
                {layerList}
              </Select>
            </Label>
          </tr>
          <tr>
            <Label>
              バッファーの距離（半径）[距離単位：{this.props.config.distanceUnitName}]：
              <NumericInput defaultValue={Number(0)} onChange={this.chgBufDst} />
            </Label>
          </tr>
          <tr>
            <Label>
              <Checkbox onChange={this.chgWdgEbl} checked={this.state.widgetEnable} /> バッファーを有効にする。
            </Label>
          </tr>
        </Table>
      </div>
    );
  }
}