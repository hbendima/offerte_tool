import React, { useState } from "react";

function CalcInput({ onContinue }) {
  const [rows, setRows] = useState([{ sku: "", amount: "" }]);

  const handleChange = (idx, field, value) => {
    const updated = [...rows];
    updated[idx][field] = value;
    setRows(updated);
  };

  const handleAddRow = () => {
    setRows([...rows, { sku: "", amount: "" }]);
  };

  const handleRemoveRow = idx => {
    setRows(rows.filter((_, i) => i !== idx));
  };

  const handleSubmit = e => {
    e.preventDefault();
    const validRows = rows.filter(row => row.sku && row.amount);
    if (validRows.length === 0) return;
    onContinue(validRows);
  };

  return (
    <form className="calc-input-form" onSubmit={handleSubmit}>
      <h2>Prijsberekening</h2>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Aantal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              <td>
                <input
                  value={row.sku}
                  onChange={e => handleChange(idx, "sku", e.target.value)}
                  placeholder="SKU"
                  required
                />
              </td>
              <td>
                <input
                  type="number"
                  min={1}
                  value={row.amount}
                  onChange={e => handleChange(idx, "amount", e.target.value)}
                  placeholder="Aantal"
                  required
                />
              </td>
              <td>
                {rows.length > 1 && (
                  <button type="button" onClick={() => handleRemoveRow(idx)}>
                    Verwijder
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={handleAddRow}>Rij toevoegen</button>
      <button type="submit">Continue</button>
    </form>
  );
}

export default CalcInput;