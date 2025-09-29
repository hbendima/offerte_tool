import React from "react";

function CalcResult({ products }) {
  if (!products || products.length === 0) return null;
  return (
    <div className="calc-result">
      <h2>Prijsberekening resultaat</h2>
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Omschrijving</th>
            <th>Aantal</th>
            <th>Prijs</th>
            <th>Kostprijs</th>
            <th>Totale prijs</th>
            <th>Marge %</th>
          </tr>
        </thead>
        <tbody>
          {products.map(prod => (
            <tr key={prod.sku}>
              <td>{prod.sku}</td>
              <td>{prod.name}</td>
              <td>{prod.amount}</td>
              <td>€ {prod.price.toFixed(2)}</td>
              <td>€ {prod.cost.toFixed(2)}</td>
              <td>€ {(prod.price * prod.amount).toFixed(2)}</td>
              <td>{prod.margin_pct.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CalcResult;