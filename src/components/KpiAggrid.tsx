import React, {
    useMemo,
    useState,
    useRef,
    useEffect,
    forwardRef,
    useImperativeHandle
} from "react";
import {ColDef, ModuleRegistry} from "ag-grid-community";
import type { CellClassParams, CellStyle } from "ag-grid-community"; // ⚠️ 確保你已經有 import
import { AllEnterpriseModule } from "ag-grid-enterprise";
import { AgGridReact, AgGridReact as AgGridReactType } from "ag-grid-react";
import { AG_GRID_LOCALE_TW } from "@ag-grid-community/locale";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";
import {Toaster,toast} from "react-hot-toast";
ModuleRegistry.registerModules([AllEnterpriseModule]);

interface KpiReport {
    year: number;
    period: string;
    kpiReportValue: number;
}

interface KpiDataCycle {
    reports?: KpiReport[];
}

export interface IRow {
    id: number;
    category: string; // e.g. "基礎型", "客製型"
    type: string;     // e.g. "basic", "custom"
    [key: string]: any;
}

interface GridComponentProps {
    columnDefs: ColDef<IRow>[];
    rowData: IRow[];
    defaultColDef?: ColDef;
    activeCategory: string;
    activeType: string;
    columnTitleMap: Record<string, string>;
    isLoading?: boolean;
    onExportData?: (type: 'excel' | 'csv') => void;
    quickFilterText?: string;
}

const GridComponent = forwardRef<AgGridReactType<IRow> | null, GridComponentProps>(
    (
        {
            columnDefs,
            rowData,
            defaultColDef,
            activeCategory,
            activeType,
            columnTitleMap,
            isLoading,
            quickFilterText,
        },
        ref
    ) => {
    const [isEditable, setIsEditable] = useState(false);
    const [selectedRows, setSelectedRows] = useState<IRow[]>([]);
    const [selectedDetail, setSelectedDetail] = useState<IRow | null>(null);
    const gridRef = useRef<AgGridReactType<IRow>>(null);

    // ✅ 把 gridRef 暴露給父層
    useImperativeHandle(ref, () => gridRef.current!);

    //載入詳細資料圖片
    const [filterRange, setFilterRange] = useState("all");
    const [chartData, setChartData] = useState<any[]>([]);
    const [isChartLoading, setIsChartLoading] = useState(false);



    useEffect(() => {
        const allReports = selectedDetail?.kpiDatas?.flatMap((kpiData: KpiDataCycle) =>
            (kpiData.reports || []).map((report) => ({
                year: report.year,
                period: report.period,
                kpiReportValue: report.kpiReportValue,
            }))
        );

        if (!allReports || allReports.length === 0) {
            setChartData([]); // ✅ 清空圖表
            return;
        }

        setIsChartLoading(true);
        const timer = setTimeout(() => {
            const sorted = [...allReports].sort((a, b) =>
                `${a.year}_${a.period}`.localeCompare(`${b.year}_${b.period}`)
            );

            const mapped = sorted.map((r) => ({
                name: `${r.year}_${r.period}`,
                value: parseFloat(r.kpiReportValue),
            }));

            setChartData(filterRange === "last4" ? mapped.slice(-4) : mapped);
            setIsChartLoading(false);
        }, 300);

        return () => clearTimeout(timer);
    }, [selectedDetail, filterRange]);

    // useEffect(() => {
    //     if (quickFilterText && gridRef.current?.api) {
    //         gridRef.current.api.setQuickFilter(quickFilterText);
    //     }
    // }, [quickFilterText]);



    const filteredRowData = useMemo(() => {
        const result = rowData.filter((row) => {
            const matchCategory =
                activeCategory === "tab_all" || row.field === activeCategory;
            const matchType =
                activeType === "type_all" ||
                (activeType === "basic" && row.category === "基礎型") ||
                (activeType === "custom" && row.category === "客製型");
            return matchCategory && matchType;
        });

        // 🔸 依是否符合目標值排序，未達標放前面
        return result.sort((a, b) => {
            const compare = (item: IRow): boolean => {
                if (!item.isIndicator) return true;  // 如果不是指標，視為合格，排後面

                const actual = item.lastReportValue;
                const target = item.lastTargetValue;
                const operator = item.lastComparisonOperator;

                if (typeof actual !== "number" || typeof target !== "number") return true; // 排後面

                switch (operator) {
                    case ">=": return actual >= target;
                    case "<=": return actual <= target;
                    case ">":  return actual > target;
                    case "<":  return actual < target;
                    case "=":
                    case "==": return actual === target;
                    default:   return true; // 未知邏輯視為合格
                }
            };

            return Number(compare(a)) - Number(compare(b)); // false (不合格=0) 排在前
        });
    }, [rowData, activeCategory, activeType]);

    const toggleEditMode = () => {
        setIsEditable((prev) => !prev);
        setSelectedRows([]);
    };

    const onSelectionChanged = (event: any) => {
        setSelectedRows(event.api.getSelectedRows());
    };

    const deleteSelectedRows = () => {
        if (selectedRows.length === 0) return toast.error("請先選擇要刪除的資料！");
        toast.error("⚠️ 僅從畫面中刪除，未同步後端");
        setSelectedRows([]);
    };

    // ✅ 建議寫法：使用 AG Grid 內建的選擇欄位類型
    const checkboxSelectionCol: ColDef = {
        type: "agCheckboxSelectionColumn",
        width: 50,
        pinned: "left",
        suppressSizeToFit: true,
    };

    const actionColumn: ColDef = {
        headerName: "操作",
        field: "actions",
        pinned: "right",
        width: 120,
        cellRenderer: (params: any) => (
            <span
                className="text-blue-600 text-sm hover:underline cursor-pointer"
                onClick={() => setSelectedDetail(params.data)}
            >
                查看詳情
            </span>
        )
    };

    const onGridReady = (params: any) => {
        try {
            const allColumnIds: string[] = [];
            const columns = params?.columnApi?.getAllColumns?.();
            if (columns && Array.isArray(columns)) {
                columns.forEach((col: any) => {
                    allColumnIds.push(col.getId());
                });
                params.columnApi.autoSizeColumns(allColumnIds, false);
            }
        } catch (err) {
            console.error("AutoSize column failed:", err);
        }
    };

    return (
        <>
            <Toaster position="top-right" reverseOrder={false} />
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">

                <p className="text-sm text-gray-500 px-1">
                    類別：{activeCategory === "tab_all" ? "全部類別" : activeCategory}，
                    指標類型：
                    {activeType === "type_all"
                        ? "全部"
                        : activeType === "basic"
                            ? "基礎型"
                            : "客製型"}
                </p>

                {isLoading ? (
                    <div className="w-full h-[700px] flex items-center justify-center">
                        <span className="loading loading-spinner loading-lg text-primary">資料載入中…</span>
                    </div>
                ) : filteredRowData.length === 0 ? (
                    <div className="text-center text-gray-500 mt-6">
                        查無符合條件的資料
                    </div>
                ) : (
                    <div
                        className="ag-theme-quartz"
                        style={{width: "100%", height: "700px", marginTop: "20px"}}
                    >
                        <AgGridReact
                            key={`${activeCategory}-${activeType}`}
                            ref={gridRef}
                            quickFilterText={quickFilterText}
                            localeText={AG_GRID_LOCALE_TW}
                            onGridReady={onGridReady}
                            rowData={filteredRowData}
                            sideBar={{
                                toolPanels: [
                                    {
                                        id: 'columns',
                                        labelDefault: '欄位',
                                        labelKey: 'columns',
                                        iconKey: 'columns',
                                        toolPanel: 'agColumnsToolPanel',
                                    }
                                ],
                            }}
                            columnDefs={[
                                ...(isEditable ? [checkboxSelectionCol] : []),
                                ...columnDefs.map((col) => {
                                    if (col.field === "lastReportValue") {
                                        return {
                                            ...col,
                                            editable: isEditable,
                                            cellStyle: (params: CellClassParams<IRow>): CellStyle => {
                                                const actual = params.value;
                                                const data = params.data;

                                                if (!data || actual === null || actual === undefined) {
                                                    return {textAlign: "left"};
                                                }

                                                if (!data.isIndicator) {
                                                    return {textAlign: "left"};  // 不是指標，直接不檢查
                                                }

                                                const target = data.lastTargetValue;
                                                const operator = data.lastComparisonOperator;

                                                let meets = true;
                                                if (typeof actual === "number" && typeof target === "number") {
                                                    switch (operator) {
                                                        case ">=":
                                                            meets = actual >= target;
                                                            break;
                                                        case "<=":
                                                            meets = actual <= target;
                                                            break;
                                                        case ">":
                                                            meets = actual > target;
                                                            break;
                                                        case "<":
                                                            meets = actual < target;
                                                            break;
                                                        case "=":
                                                        case "==":
                                                            meets = actual === target;
                                                            break;
                                                        default:
                                                            meets = true;
                                                    }
                                                }

                                                return meets
                                                    ? {textAlign: "left"}
                                                    : {
                                                        textAlign: "left",
                                                        // backgroundColor: "#fdecea",
                                                        color: "#d32f2f",
                                                        fontWeight: "bold"
                                                    };
                                            },
                                            cellRenderer: (params: CellClassParams<IRow>) => {
                                                const actual = params.value;
                                                const data = params.data;

                                                if (!data || actual === null || actual === undefined) return actual;

                                                const target = data.lastTargetValue;
                                                const operator = data.lastComparisonOperator;

                                                let meets = true;
                                                if (typeof actual === "number" && typeof target === "number") {
                                                    switch (operator) {
                                                        case ">=":
                                                            meets = actual >= target;
                                                            break;
                                                        case "<=":
                                                            meets = actual <= target;
                                                            break;
                                                        case ">":
                                                            meets = actual > target;
                                                            break;
                                                        case "<":
                                                            meets = actual < target;
                                                            break;
                                                        case "=":
                                                        case "==":
                                                            meets = actual === target;
                                                            break;
                                                        default:
                                                            meets = true;
                                                    }
                                                }

                                                return meets ? actual : `⚠️ ${actual}`;
                                            }
                                        };
                                    }

                                    return {
                                        ...col,
                                        editable: isEditable,
                                    };
                                }),
                                actionColumn,
                            ]}
                            defaultColDef={{
                                sortable: true,
                                filter: true,
                                resizable: true,
                                editable: isEditable,
                                ...defaultColDef,
                            }}
                            rowSelection="multiple"
                            onSelectionChanged={onSelectionChanged}
                            animateRows={true}
                            pagination={true}
                            paginationPageSize={20}
                            singleClickEdit={true}
                            stopEditingWhenCellsLoseFocus={true}
                            getRowStyle={(params) => {
                                const row = params.data;
                                const actual = row.lastReportValue;
                                const target = row.lastTargetValue;
                                const operator = row.lastComparisonOperator;

                                if (typeof actual === "number" && typeof target === "number") {
                                    let meets ;
                                    switch (operator) {
                                        case ">=":
                                            meets = actual >= target;
                                            break;
                                        case "<=":
                                            meets = actual <= target;
                                            break;
                                        case ">":
                                            meets = actual > target;
                                            break;
                                        case "<":
                                            meets = actual < target;
                                            break;
                                        case "=":
                                        case "==":
                                            meets = actual === target;
                                            break;
                                        default:
                                            meets = true;
                                    }

                                    if (!meets) {
                                        return {
                                            // backgroundColor: "#fdecea", // 淺紅色
                                            color: "#d32f2f",
                                            fontWeight: "bold"
                                        };
                                    }
                                }

                                return undefined; // 默認樣式
                            }}
                        />
                    </div>
                )}
                {selectedDetail && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-xl relative">
                            <h2 className="text-xl font-semibold mb-4 text-primary">指標詳情</h2>
                            <p className="text-sm font-semibold mb-2 text-base-content">歷史執行情況：</p>

                            <div className="mb-2 flex justify-between items-center">
                                <span className="text-sm text-gray-500">KPI 趨勢圖</span>
                                <select
                                    aria-label="篩選條件"
                                    className="select select-sm select-bordered text-base-content"
                                    value={filterRange}
                                    onChange={(e) => setFilterRange(e.target.value)}
                                >
                                    <option value="all">全部</option>
                                    <option value="last4">最近四期</option>
                                </select>
                            </div>

                            <div className="h-64 mb-4 border rounded flex items-center justify-center bg-gray-50">
                                {isChartLoading ? (
                                    <span
                                        className="loading loading-spinner loading-md mb-2 text-base-content">指標趨勢圖載入中，請稍候…</span>
                                ) : chartData.length === 0 ? (
                                    <div className="text-gray-400 text-sm">尚無執行資料</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData}>
                                            <XAxis dataKey="name"/>
                                            <YAxis
                                                label={{
                                                    value: selectedDetail.unit || "單位",
                                                    position: "insideLeft",
                                                }}
                                            />
                                            <Tooltip
                                                content={({active, payload, label}) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div
                                                                className="bg-white border p-2 rounded shadow text-xs">
                                                                <p>{label}</p>
                                                                <p>
                                                                    執行值：{payload[0].value} {selectedDetail.unit || ""}
                                                                </p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#8884d8"
                                                strokeWidth={2}
                                                dot={{r: 4}}
                                                activeDot={{r: 6}}
                                            />
                                            {selectedDetail.targetValue && (
                                                <ReferenceLine
                                                    y={selectedDetail.targetValue}
                                                    stroke="gray"
                                                    strokeDasharray="4 2"
                                                    label={{
                                                        value: `目標值 ${selectedDetail.targetValue}`,
                                                        position: "right",
                                                        fontSize: 10,
                                                    }}
                                                />
                                            )}
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </div>

                            <ul className="space-y-2 text-sm max-h-[300px] overflow-y-auto">
                                {Object.entries(selectedDetail).map(([key, value]) => {
                                    if (key === "kpiDatas" && Array.isArray(value)) {
                                        return (
                                            <li  className=" text-base-content" key={key}>
                                                <strong>KPI 循環資料：</strong>
                                                <ul className="list-disc list-inside ml-4 space-y-2">
                                                    {value.map((kpiData: any, idx: number) => (
                                                        <li key={idx}>
                                                            <div className="mb-1 font-semibold">
                                                                循環名稱：{kpiData.kpiCycleName || "-"}
                                                            </div>
                                                            <div className="ml-2">
                                                                <p>基線年：{kpiData.baselineYear}</p>
                                                                <p>基線值：{kpiData.baselineValue}</p>
                                                                <p>目標值：{kpiData.targetValue}</p>
                                                                <p>備註：{kpiData.remarks || "-"}</p>
                                                                {Array.isArray(kpiData.reports) && (
                                                                    <ul className="list-disc list-inside ml-4 mt-1">
                                                                        {kpiData.reports.map((report: any, rIdx: number) => (
                                                                            <li key={rIdx}>
                                                                                {report.year}_{report.period}：{report.kpiReportValue}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                )}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </li>
                                        );
                                    }

                                    // 其他欄位照原本方式顯示
                                    return (
                                        <li  className=" text-base-content" key={key}>
                                            <strong>{columnTitleMap[key] || key}：</strong>
                                            <span> {String(value ?? "-")}</span>
                                        </li>
                                    );
                                })}
                            </ul>

                            <button
                                onClick={() => setSelectedDetail(null)}
                                className="absolute top-2 right-2 btn btn-sm btn-circle btn-outline"
                                title="關閉"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
});
GridComponent.displayName = "GridComponent";
export default GridComponent;