export default function TablePanel({ spots }) {
  return (
    <div id="tablePanel" className="panel" role="dialog" aria-modal="true" aria-hidden="false">
      <div className="table-wrap">
        <table id="tbl">
          <thead>
            <tr>
              <th>Spot</th>
              <th>Water</th>
              <th>Season</th>
              <th>Skill</th>
            </tr>
          </thead>
          <tbody id="spotsBody">
            {spots.map(s => (
              <tr key={s.id} className="parent">
                <td className="spot" data-label="Spot">{s.name}</td>
                <td data-label="Water">{s.water}</td>
                <td data-label="Season">{s.season}</td>
                <td data-label="Skill">{s.skill.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
