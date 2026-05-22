"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface ExtractedBoleto {
  supplier: string;
  amount: number;
  dueDate: string;
  digitableLine: string;
  bankCode?: string;
  description?: string;
  confidence: number;
}

export default function BoletoOcrPage() {
  const [uploading, setUploading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedBoleto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("Outros");

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setExtracted(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/financial/ocr/boleto`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erro ao processar");
      
      setExtracted(json.extracted);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }, [category]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">📄 OCR de Boletos</h1>
        <p className="text-slate-500">
          Arraste o PDF do boleto e a IA extrairá automaticamente os dados.
        </p>
      </div>

      <div className="card">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Categoria
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input mb-4"
        >
          <option>Aluguel</option>
          <option>Energia</option>
          <option>Internet/Telefonia</option>
          <option>Material Médico</option>
          <option>Laboratório</option>
          <option>Contador</option>
          <option>Limpeza</option>
          <option>Outros</option>
        </select>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary-500 bg-primary-50"
              : "border-surface-border hover:border-primary-400 hover:bg-surface-muted"
          } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={48} className="text-primary-500 animate-spin" />
              <p className="text-slate-600 font-medium">
                Lendo boleto com IA... (10-30 segundos)
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload size={48} className="text-slate-400" />
              <p className="text-slate-700 font-medium">
                {isDragActive
                  ? "Solte o arquivo aqui..."
                  : "Arraste o PDF ou clique para selecionar"}
              </p>
              <p className="text-xs text-slate-500">PDF até 10 MB</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="card border-l-4 border-semantic-danger">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-semantic-danger" size={20} />
            <div>
              <h3 className="font-semibold text-slate-800">Erro</h3>
              <p className="text-sm text-slate-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      {extracted && (
        <div className="card border-l-4 border-semantic-success">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle2 className="text-semantic-success" size={24} />
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800">
                Boleto extraído com sucesso!
              </h3>
              <p className="text-xs text-slate-500">
                Confiança da IA: {(extracted.confidence * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Beneficiário" value={extracted.supplier} />
            <Field
              label="Valor"
              value={`R$ ${extracted.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
              highlight
            />
            <Field
              label="Vencimento"
              value={new Date(extracted.dueDate).toLocaleDateString("pt-BR")}
            />
            <Field label="Banco" value={extracted.bankCode || "—"} />
            <div className="col-span-2">
              <Field
                label="Linha Digitável"
                value={extracted.digitableLine}
                mono
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button className="btn-primary flex-1">
              ✓ Confirmar e Salvar em Contas a Pagar
            </button>
            <button
              onClick={() => setExtracted(null)}
              className="btn-outline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
  highlight = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div
        className={`${mono ? "font-mono text-xs" : ""} ${
          highlight ? "text-lg font-bold text-primary-600" : "font-medium text-slate-800"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
