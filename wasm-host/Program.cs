using System.Diagnostics;
using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using System.Text;
using System.Text.Json;
using ImeWlConverter.Abstractions.Contracts;
using ImeWlConverter.Abstractions.Enums;
using ImeWlConverter.Abstractions.Models;
using ImeWlConverter.Abstractions.Options;
using ImeWlConverter.Application.Bootstrap;
using ImeWlConverter.Application.Mapping;
using ImeWlConverter.Core.CodeGeneration;
using ImeWlConverter.Core.Filters;
using ImeWlConverter.Core.Pipeline;
using ImeWlConverter.Core.Pipeline.FilterModules;
using ImeWlConverter.Core.WordRank;
using ImeWlConverter.Formats.SelfDefining;
using Microsoft.Extensions.DependencyInjection;

Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
await Task.CompletedTask;

[SupportedOSPlatform("browser")]
public static partial class BrowserConverter
{
    private static readonly ServiceProvider Services = ImeWlConverterBootstrapper.CreateServiceProvider(services =>
        services.AddSingleton<IFilterModule, BrowserEnglishTransformModule>());
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly BrowserLimits Limits = JsonSerializer.Deserialize<BrowserLimits>(
        typeof(BrowserConverter).Assembly.GetManifestResourceStream("Converter.Limits")!, Json)!;
    private static readonly List<(string Name, byte[] Data)> Inputs = [];
    private static byte[]? outputData;
    private static readonly Dictionary<string, string> Names = new()
    {
        ["Pinyin"] = "拼音", ["TerraPinyin"] = "地球拼音", ["Wubi86"] = "五笔 86", ["Wubi98"] = "五笔 98",
        ["WubiNewAge"] = "五笔新世纪", ["Zhengma"] = "郑码", ["Cangjie5"] = "仓颉五代", ["Zhuyin"] = "注音",
        ["Chaoyin"] = "超音", ["QingsongErbi"] = "青松二笔", ["ChaoqiangErbi"] = "超强二笔",
        ["XiandaiErbi"] = "现代二笔", ["YinxingErbi"] = "隐形二笔", ["UserDefine"] = "自定义编码"
    };

    [JSImport("progress", "bridge")]
    internal static partial void Report(string stage, int current, int total);

    [JSExport]
    public static string Capabilities()
    {
        var generators = Services.GetServices<ICodeGenerator>().Select(g => g.SupportedType.ToString()).Distinct().ToList();
        generators.Add("UserDefine"); // Supplied by this host's in-memory mapping adapter.
        return JsonSerializer.Serialize(new
        {
            importers = Services.GetServices<IFormatImporter>().Select(f => f.Metadata),
            exporters = Services.GetServices<IFormatExporter>().Select(ExportMetadata),
            generators = generators.Select(id => new { id, name = Names.GetValueOrDefault(id, id) })
        }, Json);
    }

    [JSExport]
    public static void Begin() { Inputs.Clear(); outputData = null; }

    [JSExport]
    public static void AddInput(string name, byte[] data)
    {
        if (Inputs.Count >= Limits.MaxFiles || Inputs.Sum(i => (long)i.Data.Length) + data.Length > Limits.MaxInputBytes)
            throw new InvalidOperationException("超过单次 100 个文件或 50 MB 输入限制。");
        Inputs.Add((name, data));
    }

    [JSExport]
    public static byte[] TakeOutput()
    {
        var data = outputData ?? throw new InvalidOperationException("转换结果不存在。");
        outputData = null;
        return data;
    }

    [JSExport]
    public static async Task<string> Convert(string from, string to, string settingsJson, string mapping)
    {
        var watch = Stopwatch.StartNew();
        if (Inputs.Count == 0) throw new InvalidOperationException("请选择词库文件。");
        var settings = JsonSerializer.Deserialize<BrowserSettings>(settingsJson, Json) ?? new();
        Validate(settings);
        var importer = Services.GetServices<IFormatImporter>().SingleOrDefault(f => f.Metadata.Id == from)
            ?? throw new InvalidOperationException("未知输入格式。");
        var exporter = Services.GetServices<IFormatExporter>().SingleOrDefault(f => f.Metadata.Id == to)
            ?? throw new InvalidOperationException("未知输出格式。");
        if (from == "self" || to == "self") ConfigureSelf(settings.CustomFormat, importer, exporter);
        var options = new ConversionOptions
        {
            Import = new() { SourceCodeType = Enum.Parse<CodeType>(settings.SourceCode), EncodingName = NullIfEmpty(settings.Encoding) },
            Export = new()
            {
                TargetCodeType = settings.Code == "NoCode" ? Enum.Parse<CodeType>(settings.SourceCode) : Enum.Parse<CodeType>(settings.Code),
                EncodingName = NullIfEmpty(settings.ExportEncoding), SortType = Enum.Parse<SortType>(settings.Sort), SortDescending = settings.Descending,
                DictionaryId = NullIfEmpty(settings.DictionaryId), DictionaryName = NullIfEmpty(settings.DictionaryName),
                DictionaryCategory = NullIfEmpty(settings.DictionaryCategory), DictionaryDescription = NullIfEmpty(settings.DictionaryDescription),
                SourceFileName = Inputs[0].Name
            },
            ChineseConversion = Enum.Parse<ChineseConversionMode>(settings.Chinese),
            CodeGeneration = new()
            {
                TargetCodeType = Enum.Parse<CodeType>(settings.Code), CodeFilePath = settings.Code == "UserDefine" ? "browser-mapping" : null,
                MultiCodeFormat = settings.MultiCode, KeepEnglishInCode = settings.KeepEnglish, KeepNumberInCode = settings.KeepNumber,
                KeepPunctuationInCode = settings.KeepPunctuation, ConvertFullWidth = settings.FullWidth,
                TranslateNumbersToChinese = settings.ChineseNumbers, PrefixEnglishWithUnderscore = settings.Underscore
            }
        };
        var warnings = new List<string>();
        try
        {
            var entries = new List<WordEntry>();
            for (var index = 0; index < Inputs.Count; index++)
            {
                var input = Inputs[index];
                Report($"正在导入 {input.Name}", index + 1, Inputs.Count);
                try
                {
                    using var stream = new MemoryStream(input.Data, writable: false);
                    var result = await importer.ImportAsync(stream, options.Import);
                    entries.AddRange(result.Entries);
                    warnings.AddRange(result.Errors.Take(20).Select(e => $"{input.Name}：{e}"));
                    if (result.ErrorCount > 0) warnings.Add($"{input.Name}：导入器报告 {result.ErrorCount} 条解析错误。");
                    if (result.Entries.Count == 0) warnings.Add($"{input.Name}：没有识别到词条，请检查输入格式。");
                }
                catch (Exception ex) { throw new InvalidOperationException($"{input.Name}：{ex.Message}", ex); }
            }
            var imported = entries.Count;
            IWordRankGenerator? rank = settings.Rank == "" ? null : new DefaultWordRankGenerator { DefaultRank = int.Parse(settings.Rank), ForceOverride = true };
            var transform = new EntryTransformationService(Services.GetRequiredService<IChineseConverter>(), rank,
                Services.GetRequiredService<CodeGenerationService>(), new MemoryCodeSource(mapping));
            var filtered = new FilterPipelineFactory(Services.GetServices<IFilterModule>()
                .Where(m => m is not RankFilterModule and not LengthFilterModule)
                .Append(new BrowserRangeFilterModule())).Create(settings.Filter);
            var transformed = await transform.ApplyAsync(entries, options, filtered, new InlineProgress(), default);
            // Exporters may impose their own format-specific order (e.g. Rime by rank).
            IEnumerable<WordEntry> ordered = settings.Sort switch
            {
                "ByWord" => settings.Descending ? transformed.OrderByDescending(e => e.Word, StringComparer.Ordinal) : transformed.OrderBy(e => e.Word, StringComparer.Ordinal),
                "ByCode" => settings.Descending ? transformed.OrderByDescending(e => e.Code?.GetPrimaryCode(" "), StringComparer.Ordinal) : transformed.OrderBy(e => e.Code?.GetPrimaryCode(" "), StringComparer.Ordinal),
                "ByRank" => settings.Descending ? transformed.OrderByDescending(e => e.Rank) : transformed.OrderBy(e => e.Rank),
                _ => settings.Descending ? transformed.Reverse() : transformed
            };
            if (to == "rime" && (settings.Sort != "Default" || settings.Descending)) warnings.Add("Rime 格式固定按词频降序排列，已覆盖排序设置。");
            if (settings.Encoding == "Big5") warnings.Add("Big5 输入存在已知上游解码错误，请检查内容。");
            if (settings.Encoding != "" || settings.ExportEncoding != "") warnings.Add("文本编码覆盖由具体格式决定，部分格式使用固定编码并忽略该设置。");
            Report("正在导出词库…", 0, transformed.Count);
            using var output = new MemoryStream();
            var exported = await exporter.ExportAsync(ordered.ToList(), output, options.Export);
            outputData = output.ToArray();
            var metadata = ExportMetadata(exporter);
            string? text = null;
            if (!metadata.IsBinary)
            {
                using var reader = new StreamReader(new MemoryStream(outputData, writable: false), exporter.OutputEncoding, detectEncodingFromByteOrderMarks: true);
                var buffer = new char[2000];
                var length = await reader.ReadBlockAsync(buffer);
                text = new string(buffer, 0, length);
            }
            return JsonSerializer.Serialize(new
            {
                imported, exported = exported.EntryCount, exportErrors = exported.ErrorCount, warnings,
                elapsedMs = watch.Elapsed.TotalMilliseconds, preview = text,
                isBinary = metadata.IsBinary,
                extension = to == "rime" ? ".dict.yaml" : metadata.FileExtension
            }, Json);
        }
        finally { Inputs.Clear(); }
    }

    private static string? NullIfEmpty(string value) => string.IsNullOrWhiteSpace(value) ? null : value;
    // The pinned upstream SCEL exporter omits IsBinary on its plugin attribute.
    private static FormatMetadata ExportMetadata(IFormatExporter exporter) =>
        exporter.Metadata.Id == "scel" ? exporter.Metadata with { IsBinary = true } : exporter.Metadata;
    private static void Validate(BrowserSettings s)
    {
        if (s.Rank != "" && (!int.TryParse(s.Rank, out var rank) || rank < 0)) throw new ArgumentException("固定词频应为有效的非负整数。");
        if (s.DictionaryId.Length > 6) throw new ArgumentException("词库编号最多 6 个字符。");
        if (!s.Filter.NoFilter && (s.Filter.WordLengthFrom < 1 || s.Filter.WordLengthTo < s.Filter.WordLengthFrom ||
            s.Filter.WordRankFrom < 0 || s.Filter.WordRankTo < s.Filter.WordRankFrom || s.Filter.WordRankPercentage is < 1 or > 100))
            throw new ArgumentException("过滤范围无效。");
    }
    private static void ConfigureSelf(string spec, IFormatImporter importer, IFormatExporter exporter)
    {
        if (!SelfDefiningSpecParser.TryParse(spec, out var parsed, out var error) || parsed is null)
            throw new ArgumentException(error ?? "请填写自定义格式规则。");
        if (parsed.OrderSpec.Order().SequenceEqual("123") == false) throw new ArgumentException("自定义格式前三位必须为 1、2、3 的排列。");
        if (importer is SelfDefiningImporter i)
        { i.OrderSpec = parsed.OrderSpec; i.PinyinSeparator = parsed.PinyinSeparator; i.FieldSeparator = parsed.FieldSeparator; i.ShowPinyin = parsed.ShowPinyin; i.ShowWord = parsed.ShowWord; i.ShowRank = parsed.ShowRank; }
        if (exporter is SelfDefiningExporter e)
        { e.OrderSpec = parsed.OrderSpec; e.PinyinSeparator = parsed.PinyinSeparator; e.FieldSeparator = parsed.FieldSeparator; e.ShowPinyin = parsed.ShowPinyin; e.ShowWord = parsed.ShowWord; e.ShowRank = parsed.ShowRank; }
    }
    private sealed class InlineProgress : IProgress<ProgressInfo>
    {
        public void Report(ProgressInfo value) => BrowserConverter.Report(value.Message ?? "正在转换…", value.Current, value.Total);
    }
}

public sealed class MemoryCodeSource(string text) : ISelfDefiningCodeSource
{
    public Task<IReadOnlyDictionary<char, List<string>>> LoadAsync(string _, CancellationToken ct = default)
    {
        var result = new Dictionary<char, List<string>>();
        foreach (var line in text.Split('\n'))
        {
            ct.ThrowIfCancellationRequested();
            if (string.IsNullOrWhiteSpace(line)) continue;
            var parts = line.TrimEnd('\r').Split('\t');
            if (parts.Length < 2 || parts[0].Length != 1 || string.IsNullOrWhiteSpace(parts[1]))
                throw new ArgumentException("映射表每行应为：单个汉字、Tab、编码。");
            if (!result.TryGetValue(parts[0][0], out var codes)) result[parts[0][0]] = codes = [];
            codes.Add(parts[1].Trim());
        }
        if (result.Count == 0) throw new ArgumentException("自定义映射表为空。");
        return Task.FromResult<IReadOnlyDictionary<char, List<string>>>(result);
    }
}

// The transform is implemented upstream but is not wired by its default module list.
// Register it here so the browser's exposed option actually invokes that implementation.
public sealed class BrowserEnglishTransformModule : IFilterModule
{
    public int Order => 11;
    public void Contribute(FilterConfig config, FilterPipelineBuilder builder)
    {
        if (config.ReplaceEnglish) builder.AddTransform(new EnglishRemoveTransform());
    }
}

// Always enforce the ranges shown in the browser, including 0/1 boundary values.
public sealed class BrowserRangeFilterModule : IFilterModule
{
    public int Order => 35;
    public void Contribute(FilterConfig config, FilterPipelineBuilder builder)
    {
        builder.AddFilter(new LengthFilter { MinLength = config.WordLengthFrom, MaxLength = config.WordLengthTo });
        builder.AddFilter(new RankFilter { MinRank = config.WordRankFrom, MaxRank = config.WordRankTo });
    }
}

public sealed record BrowserLimits(int MaxInputBytes, int WarnInputBytes, int MaxMappingBytes, int MaxFiles);

public sealed class BrowserSettings
{
    public string Code { get; set; } = "NoCode";
    public string SourceCode { get; set; } = "Pinyin";
    public string Chinese { get; set; } = "None";
    public string Encoding { get; set; } = "";
    public string ExportEncoding { get; set; } = "";
    public string Sort { get; set; } = "Default";
    public bool Descending { get; set; }
    public string Rank { get; set; } = "";
    public string CustomFormat { get; set; } = "213 ,nyyy";
    public string MultiCode { get; set; } = "";
    public bool KeepEnglish { get; set; } = true;
    public bool KeepNumber { get; set; } = true;
    public bool KeepPunctuation { get; set; }
    public bool FullWidth { get; set; }
    public bool ChineseNumbers { get; set; }
    public bool Underscore { get; set; }
    public string DictionaryId { get; set; } = "";
    public string DictionaryName { get; set; } = "";
    public string DictionaryCategory { get; set; } = "";
    public string DictionaryDescription { get; set; } = "";
    public FilterConfig Filter { get; set; } = new() { NoFilter = true };
}
